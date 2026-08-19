import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/wine_sales_order.dart';
import '../../providers/wine_stock_provider.dart';
import '../../providers/wine_customer_provider.dart';
import '../../../../utils/formatters.dart';
import '../../../../database/database_helper.dart';
import 'wine_sales_order_screen.dart';

class WineOrderHistoryScreen extends StatefulWidget {
  const WineOrderHistoryScreen({super.key});

  @override
  State<WineOrderHistoryScreen> createState() => _WineOrderHistoryScreenState();
}

class _WineOrderHistoryScreenState extends State<WineOrderHistoryScreen> {
  final _searchController = TextEditingController();
  List<WineSalesOrder> _allOrders = [];
  List<WineSalesOrder> _filteredOrders = [];
  bool _isLoading = true;
  DateTime? _filterStart;
  DateTime? _filterEnd;

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

  Future<void> _loadOrders() async {
    setState(() => _isLoading = true);
    final provider = context.read<WineStockProvider>();
    await provider.loadSalesOrders();
    _allOrders = provider.salesOrders;
    _applyFilters();
    setState(() => _isLoading = false);
  }

  void _applyFilters() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      _filteredOrders = _allOrders.where((order) {
        // Time filter
        if (_filterStart != null && order.date.isBefore(_filterStart!)) return false;
        if (_filterEnd != null && order.date.isAfter(_filterEnd!)) return false;
        // Text filter
        if (query.isNotEmpty) {
          return (order.customerName ?? '').toLowerCase().contains(query) ||
              (order.customerPhone ?? '').contains(query) ||
              (order.customerAddress ?? '').toLowerCase().contains(query) ||
              (order.note1 ?? '').toLowerCase().contains(query) ||
              (order.note2 ?? '').toLowerCase().contains(query) ||
              Formatters.currency(order.totalAmount).contains(query) ||
              Formatters.date(order.date).contains(query);
        }
        return true;
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Đơn hàng'),
        actions: [
          IconButton(
            icon: const Icon(Icons.date_range),
            tooltip: 'Lọc theo thời gian',
            onPressed: _showDateFilter,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Tìm theo tên, SĐT, địa chỉ...',
                prefixIcon: const Icon(Icons.search),
                isDense: true,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: () {
                        _searchController.clear();
                        _applyFilters();
                      })
                    : null,
              ),
              onChanged: (_) => _applyFilters(),
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          // Date filter indicator
          if (_filterStart != null || _filterEnd != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              color: Theme.of(context).colorScheme.primaryContainer,
              child: Row(
                children: [
                  const Icon(Icons.filter_alt, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    '${_filterStart != null ? Formatters.date(_filterStart!) : '...'} → ${_filterEnd != null ? Formatters.date(_filterEnd!) : '...'}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: () {
                      setState(() { _filterStart = null; _filterEnd = null; });
                      _applyFilters();
                    },
                    child: const Text('Xóa lọc'),
                  ),
                ],
              ),
            ),
          // Orders list
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredOrders.isEmpty
                    ? Center(child: Text('Không có đơn hàng',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Theme.of(context).colorScheme.outline)))
                    : RefreshIndicator(
                        onRefresh: _loadOrders,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(8),
                          itemCount: _filteredOrders.length,
                          itemBuilder: (context, index) {
                            final order = _filteredOrders[index];
                            return _OrderCard(
                              order: order,
                              onTap: () => _showOrderDetail(order),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          await Navigator.push(context,
              MaterialPageRoute(builder: (_) => const WineSalesOrderScreen()));
          _loadOrders();
        },
        child: const Icon(Icons.add),
      ),
    );
  }

  void _showDateFilter() async {
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      initialDateRange: _filterStart != null && _filterEnd != null
          ? DateTimeRange(start: _filterStart!, end: _filterEnd!)
          : null,
    );
    if (range != null) {
      setState(() {
        _filterStart = range.start;
        _filterEnd = range.end.add(const Duration(days: 1));
      });
      _applyFilters();
    }
  }

  void _showOrderDetail(WineSalesOrder order) async {
    // Load full order with items
    final provider = context.read<WineStockProvider>();
    final fullOrder = await provider.getSalesOrderById(order.id);
    if (!mounted || fullOrder == null) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (ctx, scrollController) {
          return Padding(
            padding: const EdgeInsets.all(16),
            child: ListView(
              controller: scrollController,
              children: [
                // Header
                Row(
                  children: [
                    Text('Chi tiết đơn hàng', style: Theme.of(context).textTheme.titleLarge),
                    const Spacer(),
                    IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                  ],
                ),
                const Divider(),

                // Date
                _DetailRow(icon: Icons.calendar_today, label: 'Ngày', value: Formatters.date(fullOrder.date)),

                // Customer
                if (fullOrder.customerName != null && fullOrder.customerName!.isNotEmpty)
                  _DetailRow(icon: Icons.person, label: 'Khách hàng', value: fullOrder.customerName!),
                if (fullOrder.customerPhone != null && fullOrder.customerPhone!.isNotEmpty)
                  _DetailRow(icon: Icons.phone, label: 'SĐT', value: fullOrder.customerPhone!),
                if (fullOrder.customerAddress != null && fullOrder.customerAddress!.isNotEmpty)
                  _DetailRow(icon: Icons.location_on, label: 'Địa chỉ', value: fullOrder.customerAddress!),

                const SizedBox(height: 12),
                Text('Sản phẩm', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),

                // Products
                if (fullOrder.items != null && fullOrder.items!.isNotEmpty)
                  for (final item in fullOrder.items!) Card(
                    margin: const EdgeInsets.only(bottom: 4),
                    child: ListTile(
                      dense: true,
                      title: Text('${item.productName ?? "SP"} ${item.variantName != null ? "- ${item.variantName}" : ""}'),
                      subtitle: Text('${item.quantity} chai × ${Formatters.currency(item.price)}'
                          '${item.hasGlass == 1 ? " • Có ly" : ""}'
                          '${item.hasBox == 1 ? " • Có hộp" : ""}'),
                      trailing: Text(Formatters.currency(item.lineTotal),
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                    ),
                  )
                else
                  const Padding(
                    padding: EdgeInsets.all(8),
                    child: Text('Không có chi tiết sản phẩm'),
                  ),

                const SizedBox(height: 12),
                // Shipping & total
                if (fullOrder.shippingFee > 0)
                  _DetailRow(icon: Icons.local_shipping, label: 'Phí ship', value: Formatters.currency(fullOrder.shippingFee)),
                _DetailRow(icon: Icons.attach_money, label: 'Tổng tiền', value: Formatters.currency(fullOrder.totalAmount)),

                // Notes
                if (fullOrder.note1 != null && fullOrder.note1!.isNotEmpty)
                  _DetailRow(icon: Icons.notes, label: 'Ghi chú 1', value: fullOrder.note1!),
                if (fullOrder.note2 != null && fullOrder.note2!.isNotEmpty)
                  _DetailRow(icon: Icons.notes, label: 'Ghi chú 2', value: fullOrder.note2!),

                const SizedBox(height: 16),
                // Edit order button
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () async {
                      Navigator.pop(ctx);
                      final result = await Navigator.push(context,
                          MaterialPageRoute(builder: (_) => WineSalesOrderScreen(editOrder: fullOrder)));
                      if (result == true) _loadOrders();
                    },
                    icon: const Icon(Icons.edit),
                    label: const Text('Sửa đơn hàng'),
                  ),
                ),
                const SizedBox(height: 8),
                // Delete order button
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final confirm = await showDialog<bool>(
                        context: context,
                        builder: (dlg) => AlertDialog(
                          title: const Text('Xóa đơn hàng'),
                          content: const Text('Bạn có chắc muốn xóa đơn hàng này?\n\n(Lưu ý: tồn kho sẽ không được hoàn lại tự động)'),
                          actions: [
                            TextButton(onPressed: () => Navigator.pop(dlg, false), child: const Text('Hủy')),
                            FilledButton(
                              onPressed: () => Navigator.pop(dlg, true),
                              style: FilledButton.styleFrom(backgroundColor: Colors.red),
                              child: const Text('Xóa'),
                            ),
                          ],
                        ),
                      );
                      if (confirm == true) {
                        final db = await DatabaseHelper.instance.database;
                        await db.delete('wine_sales_order_items', where: 'sales_order_id = ?', whereArgs: [order.id]);
                        await db.delete('wine_sales_orders', where: 'id = ?', whereArgs: [order.id]);
                        if (ctx.mounted) Navigator.pop(ctx);
                        _loadOrders();
                      }
                    },
                    icon: const Icon(Icons.delete_outline, color: Colors.red),
                    label: const Text('Xóa đơn hàng', style: TextStyle(color: Colors.red)),
                    style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.red)),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  final WineSalesOrder order;
  final VoidCallback onTap;
  const _OrderCard({required this.order, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.receipt_long, size: 18, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(width: 8),
                  Text(Formatters.date(order.date), style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                  const Spacer(),
                  Text(Formatters.currency(order.totalAmount),
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary)),
                ],
              ),
              const SizedBox(height: 6),
              if (order.customerName != null && order.customerName!.isNotEmpty)
                Row(children: [
                  const Icon(Icons.person_outline, size: 14),
                  const SizedBox(width: 4),
                  Text(order.customerName!, style: Theme.of(context).textTheme.bodySmall),
                  if (order.customerPhone != null) ...[
                    const SizedBox(width: 8),
                    Text(order.customerPhone!, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.outline)),
                  ],
                ]),
              if (order.customerAddress != null && order.customerAddress!.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Row(children: [
                    const Icon(Icons.location_on_outlined, size: 14),
                    const SizedBox(width: 4),
                    Expanded(child: Text(order.customerAddress!, style: Theme.of(context).textTheme.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  ]),
                ),
              if (order.note1 != null && order.note1!.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(order.note1!, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.outline)),
                ),
              // Tap to see details
              if (order.items != null && order.items!.isNotEmpty) ...[
                const SizedBox(height: 6),
                for (final item in order.items!)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: Row(
                      children: [
                        const SizedBox(width: 18),
                        const Icon(Icons.circle, size: 6),
                        const SizedBox(width: 6),
                        Expanded(child: Text(
                          '${item.productName ?? "SP"} ${item.variantName != null && item.variantName != "Không màu" ? "- ${item.variantName}" : ""} × ${item.quantity}',
                          style: Theme.of(context).textTheme.bodySmall,
                        )),
                        Text(Formatters.currency(item.lineTotal),
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
              ] else
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text('Nhấn để xem chi tiết',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.primary, fontStyle: FontStyle.italic)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _DetailRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: Theme.of(context).colorScheme.outline),
          const SizedBox(width: 8),
          SizedBox(width: 80, child: Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.outline))),
          Expanded(child: Text(value, style: Theme.of(context).textTheme.bodyMedium)),
        ],
      ),
    );
  }
}
