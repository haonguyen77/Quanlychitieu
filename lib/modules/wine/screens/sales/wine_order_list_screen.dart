import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../providers/wine_data_provider.dart';
import 'wine_order_detail_screen.dart';

enum _FilterPeriod { month, year, all }

class WineOrderListScreen extends StatefulWidget {
  final VoidCallback? onBack;
  const WineOrderListScreen({super.key, this.onBack});

  @override
  State<WineOrderListScreen> createState() => _WineOrderListScreenState();
}

class _WineOrderListScreenState extends State<WineOrderListScreen> {
  static const _navy = Color(0xFF101B4D);
  static const _purple = Color(0xFF6C2BD9);
  static const _red = Color(0xFFEF3030);
  static const _border = Color(0xFFE5E7EB);

  final _searchController = TextEditingController();
  _FilterPeriod _currentPeriod = _FilterPeriod.year;
  DateTime _referenceDate = DateTime.now();
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadOrders());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  DateTime get _startDate {
    switch (_currentPeriod) {
      case _FilterPeriod.month: return DateTime(_referenceDate.year, _referenceDate.month, 1);
      case _FilterPeriod.year: return DateTime(_referenceDate.year, 1, 1);
      case _FilterPeriod.all: return DateTime(2020, 1, 1);
    }
  }

  DateTime get _endDate {
    switch (_currentPeriod) {
      case _FilterPeriod.month: return DateTime(_referenceDate.year, _referenceDate.month + 1, 1);
      case _FilterPeriod.year: return DateTime(_referenceDate.year + 1, 1, 1);
      case _FilterPeriod.all: return DateTime(2099, 12, 31);
    }
  }

  Future<void> _loadOrders() async {
    setState(() => _isLoading = true);
    await context.read<WineDataProvider>().loadOrders();
    await context.read<WineDataProvider>().loadProducts();
    if (mounted) setState(() => _isLoading = false);
  }

  List<Map<String, dynamic>> get _filteredOrders {
    final provider = context.read<WineDataProvider>();
    final query = _searchController.text.toLowerCase();
    final startStr = DateFormat('yyyy-MM-dd').format(_startDate);
    final endStr = DateFormat('yyyy-MM-dd').format(_endDate);

    return provider.orders.where((order) {
      // Date filter
      final date = order['order_date'] as String? ?? '';
      if (date.isNotEmpty) {
        if (date.compareTo(startStr) < 0 || date.compareTo(endStr) > 0) return false;
      }
      // Search filter
      if (query.isNotEmpty) {
        final name = (order['customer_name'] as String? ?? '').toLowerCase();
        final phone = (order['customer_phone'] as String? ?? '').toLowerCase();
        final note = (order['note1'] as String? ?? '').toLowerCase();
        return name.contains(query) || phone.contains(query) || note.contains(query);
      }
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white, elevation: 0,
        leading: widget.onBack != null ? IconButton(icon: const Icon(Icons.arrow_back, color: _navy), onPressed: widget.onBack) : null,
        title: const Text('Đơn hàng', style: TextStyle(color: _navy, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(icon: const Icon(Icons.search, color: _navy), onPressed: () => setState(() {})),
        ],
      ),
      body: Consumer<WineDataProvider>(
        builder: (context, provider, _) {
          if (_isLoading) return const Center(child: CircularProgressIndicator());
          final orders = _filteredOrders;

          return Column(
            children: [
              // Search + filter
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: TextField(
                  controller: _searchController,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'Tìm kiếm đơn hàng, khách hàng...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _border)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    isDense: true,
                  ),
                ),
              ),
              // Period filter
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    _periodChip('Tháng', _FilterPeriod.month),
                    const SizedBox(width: 8),
                    _periodChip('Năm', _FilterPeriod.year),
                    const SizedBox(width: 8),
                    _periodChip('Tất cả', _FilterPeriod.all),
                    const Spacer(),
                    Text('${orders.length} đơn', style: TextStyle(fontSize: 12, color: Colors.grey[500])),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              // Order list
              Expanded(
                child: orders.isEmpty
                    ? const Center(child: Text('Chưa có đơn hàng'))
                    : RefreshIndicator(
                        onRefresh: _loadOrders,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: orders.length,
                          itemBuilder: (_, i) => _buildOrderCard(orders[i], provider),
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _periodChip(String label, _FilterPeriod period) {
    final selected = _currentPeriod == period;
    return GestureDetector(
      onTap: () => setState(() { _currentPeriod = period; _referenceDate = DateTime.now(); }),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? _purple : Colors.grey[100],
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(label, style: TextStyle(fontSize: 12, color: selected ? Colors.white : Colors.grey[700], fontWeight: FontWeight.w500)),
      ),
    );
  }

  Widget _buildOrderCard(Map<String, dynamic> order, WineDataProvider provider) {
    final nf = NumberFormat('#,###', 'vi_VN');
    final df = DateFormat('dd/MM/yyyy');

    final dateStr = order['order_date'] as String? ?? '';
    DateTime date;
    try { date = DateTime.parse(dateStr); } catch (_) { date = DateTime.now(); }

    final customerName = order['customer_name'] as String? ?? 'Khách lẻ';
    final phone = order['customer_phone'] as String? ?? '';
    final address = [order['customer_address'], order['customer_district'], order['customer_city']]
        .where((s) => s != null && s.toString().isNotEmpty).join(', ');
    final total = (order['total_amount'] is num) ? (order['total_amount'] as num).toDouble() : double.tryParse(order['total_amount']?.toString() ?? '0') ?? 0;
    final shipFee = (order['ship_fee'] is num) ? (order['ship_fee'] as num).toDouble() : double.tryParse(order['ship_fee']?.toString() ?? '0') ?? 0;
    final note1 = order['note1'] as String? ?? '';
    final note2 = order['note2'] as String? ?? '';

    // Parse product lines
    List<Map<String, dynamic>> productLines = [];
    final plRaw = order['product_lines'];
    if (plRaw != null && plRaw is String && plRaw.isNotEmpty) {
      try { productLines = (List<dynamic>.from(jsonDecode(plRaw))).cast<Map<String, dynamic>>(); } catch (_) {}
    }
    // Fallback: single product
    if (productLines.isEmpty && (order['product_name'] != null || order['product_sku'] != null)) {
      productLines = [{'productName': order['product_name'], 'productSku': order['product_sku'], 'quantity': order['quantity'], 'price': order['price']}];
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white, borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _border),
      ),
      child: InkWell(
        onTap: () async {
          await Navigator.push(context, MaterialPageRoute(
            builder: (_) => WineOrderDetailScreen(order: order),
          ));
          _loadOrders();
        },
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Date
              Row(children: [
                Icon(Icons.calendar_today, size: 13, color: Colors.grey[500]),
                const SizedBox(width: 6),
                Text(df.format(date), style: TextStyle(fontSize: 12, color: Colors.grey[600])),
              ]),
              const SizedBox(height: 8),
              // Customer + total
              Row(
                children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(customerName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _navy)),
                    if (phone.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      GestureDetector(
                        onTap: () => launchUrl(Uri.parse('tel:$phone')),
                        child: Text('📞 $phone', style: TextStyle(fontSize: 12, color: Colors.blue[600])),
                      ),
                    ],
                    if (address.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text('📍 $address', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                    ],
                  ])),
                  Text('${nf.format(total.toInt())} VND', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _red)),
                ],
              ),
              // Ship fee
              if (shipFee > 0) ...[
                const SizedBox(height: 4),
                Text('Tiền ship: ${nf.format(shipFee.toInt())} VND', style: TextStyle(fontSize: 10, color: Colors.blue[600])),
              ],
              // Products
              if (productLines.isNotEmpty) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: const Color(0xFFF9F9F9), borderRadius: BorderRadius.circular(8)),
                  child: Column(children: [
                    Row(children: [
                      const Expanded(flex: 5, child: Text('Sản phẩm', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.grey))),
                      const SizedBox(width: 40, child: Text('SL', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.grey), textAlign: TextAlign.center)),
                      const Expanded(flex: 3, child: Text('Tiền', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.grey), textAlign: TextAlign.right)),
                    ]),
                    const Divider(height: 8),
                    ...productLines.map((item) {
                      final sku = item['productSku'] as String? ?? '';
                      final name = provider.getProductName(sku);
                      final displayName = name.isNotEmpty ? name : (item['productName'] as String? ?? 'SP');
                      final qty = int.tryParse(item['quantity']?.toString() ?? '0') ?? 0;
                      final price = double.tryParse(item['price']?.toString() ?? '0') ?? 0;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 3),
                        child: Row(children: [
                          Expanded(flex: 5, child: Text(displayName, style: const TextStyle(fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis)),
                          SizedBox(width: 40, child: Text('$qty', style: const TextStyle(fontSize: 11), textAlign: TextAlign.center)),
                          Expanded(flex: 3, child: Text('${nf.format((qty * price).toInt())}đ', style: const TextStyle(fontSize: 11), textAlign: TextAlign.right)),
                        ]),
                      );
                    }),
                  ]),
                ),
              ],
              // Notes
              if (note1.isNotEmpty || note2.isNotEmpty) ...[
                const SizedBox(height: 6),
                if (note1.isNotEmpty) Text('📝 $note1', style: TextStyle(fontSize: 11, color: Colors.grey[600], fontStyle: FontStyle.italic)),
                if (note2.isNotEmpty) Text('📝 $note2', style: TextStyle(fontSize: 11, color: Colors.grey[600], fontStyle: FontStyle.italic)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
