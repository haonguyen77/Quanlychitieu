import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/wine_data_provider.dart';

/// Material 3 minimal wine customer detail screen.
/// Shows customer info + order history. Edit/delete actions.
class WineCustomerDetailScreen extends StatelessWidget {
  final Map<String, dynamic> customer;
  const WineCustomerDetailScreen({super.key, required this.customer});

  static const _purple = Color(0xFF6C2BD9);
  static const _purpleLight = Color(0xFFF3EAFF);
  static const _navy = Color(0xFF101B4D);
  static const _border = Color(0xFFEEEEEE);
  static const _bg = Color(0xFFF8F9FA);

  @override
  Widget build(BuildContext context) {
    final name = customer['full_name'] as String? ?? '';
    final phone = customer['phone'] as String? ?? '';
    final address = [customer['address'], customer['district'], customer['city']]
        .where((s) => s != null && s.toString().isNotEmpty).join(', ');
    final totalOrders = customer['total_orders'] ?? 0;
    final lastOrderDate = customer['last_order_date'] as String? ?? '';
    final note = customer['note'] as String? ?? '';

    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: _navy),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Chi tiết khách hàng', style: TextStyle(color: _navy, fontWeight: FontWeight.w600, fontSize: 17)),
        centerTitle: true,
        actions: [
          IconButton(
            icon: Icon(Icons.delete_outline, color: Colors.red[400], size: 22),
            tooltip: 'Xóa',
            onPressed: () => _confirmDelete(context),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: Column(
          children: [
            // ─── Avatar + Name Hero ───────────────────────────────
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: _border),
              ),
              child: Column(
                children: [
                  Container(
                    width: 64, height: 64,
                    decoration: BoxDecoration(
                      color: _purpleLight,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Center(
                      child: Text(
                        name.isNotEmpty ? name[0].toUpperCase() : '?',
                        style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: _purple),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: _navy)),
                  if (phone.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(phone, style: TextStyle(fontSize: 14, color: Colors.grey[600])),
                  ],
                  const SizedBox(height: 16),
                  // Stats row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _statBadge(Icons.receipt_long_outlined, '$totalOrders', 'Đơn hàng'),
                      const SizedBox(width: 24),
                      _statBadge(Icons.calendar_today_outlined, _formatDate(lastOrderDate), 'Đơn gần nhất'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ─── Contact Info ─────────────────────────────────────
            _card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _sectionTitle('Thông tin liên hệ'),
                  const SizedBox(height: 12),
                  if (phone.isNotEmpty) _infoRow(Icons.phone_outlined, 'SĐT', phone),
                  if (phone.isNotEmpty && address.isNotEmpty) _divider(),
                  if (address.isNotEmpty) _infoRow(Icons.location_on_outlined, 'Địa chỉ', address),
                  if (note.isNotEmpty) ...[
                    _divider(),
                    _infoRow(Icons.notes_outlined, 'Ghi chú', note),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ─── Order History ─────────────────────────────────────
            _buildOrderHistory(context),

            const SizedBox(height: 24),
            // ─── Delete Button ────────────────────────────────────
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _confirmDelete(context),
                icon: Icon(Icons.delete_outline, color: Colors.red[400], size: 18),
                label: Text('Xóa khách hàng', style: TextStyle(color: Colors.red[400])),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  side: BorderSide(color: Colors.red[300]!),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildOrderHistory(BuildContext context) {
    final provider = context.watch<WineDataProvider>();
    final customerPhone = customer['phone'] as String? ?? '';
    final customerName = customer['full_name'] as String? ?? '';

    // Filter orders by this customer (phone match or name match)
    final orders = provider.orders.where((o) {
      final oPhone = o['customer_phone'] as String? ?? '';
      final oName = o['customer_name'] as String? ?? '';
      if (customerPhone.isNotEmpty && oPhone == customerPhone) return true;
      if (customerName.isNotEmpty && oName == customerName) return true;
      return false;
    }).toList();

    if (orders.isEmpty) {
      return _card(
        child: Column(
          children: [
            _sectionTitle('Lịch sử mua hàng'),
            const SizedBox(height: 16),
            Icon(Icons.receipt_long_outlined, size: 36, color: Colors.grey[300]),
            const SizedBox(height: 8),
            Text('Chưa có đơn hàng', style: TextStyle(fontSize: 13, color: Colors.grey[500])),
          ],
        ),
      );
    }

    final nf = NumberFormat('#,###', 'vi');
    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle('Lịch sử mua hàng (${orders.length})'),
          const SizedBox(height: 12),
          ...orders.take(10).map((o) {
            final date = o['order_date'] as String? ?? '';
            final total = _toDouble(o['total_amount']);
            final productName = o['product_name'] as String? ?? '';
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _purpleLight.withOpacity(0.4),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(color: _purple.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                    child: const Icon(Icons.receipt_outlined, size: 16, color: _purple),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(productName.isNotEmpty ? productName : 'Đơn hàng',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: _navy),
                            maxLines: 1, overflow: TextOverflow.ellipsis),
                        Text(_formatDate(date), style: TextStyle(fontSize: 10, color: Colors.grey[500])),
                      ],
                    ),
                  ),
                  Text('${nf.format(total.toInt())}₫', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _purple)),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  // ─── Shared Widgets ───────────────────────────────────────────────────────

  Widget _card({required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: child,
    );
  }

  Widget _sectionTitle(String title) {
    return Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _navy));
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30, height: 30,
            decoration: BoxDecoration(color: _purpleLight, borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, size: 15, color: _purple),
          ),
          const SizedBox(width: 12),
          SizedBox(width: 60, child: Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[500]))),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: _navy), textAlign: TextAlign.right)),
        ],
      ),
    );
  }

  Widget _statBadge(IconData icon, String value, String label) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(color: _purpleLight, borderRadius: BorderRadius.circular(12)),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: _purple),
              const SizedBox(width: 6),
              Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _purple)),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(fontSize: 10, color: Colors.grey[500])),
      ],
    );
  }

  Widget _divider() => Divider(height: 1, color: Colors.grey[100]);

  String _formatDate(String dateStr) {
    if (dateStr.isEmpty) return '-';
    try {
      final d = DateTime.parse(dateStr);
      return DateFormat('dd/MM/yyyy').format(d);
    } catch (_) {
      return dateStr;
    }
  }

  double _toDouble(dynamic v) {
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  void _confirmDelete(BuildContext context) {
    final id = customer['id'] as String? ?? '';
    if (id.isEmpty) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Xóa khách hàng', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 17)),
        content: const Text('Khách hàng sẽ bị xóa khỏi danh sách.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text('Hủy', style: TextStyle(color: Colors.grey[600]))),
          FilledButton(
            onPressed: () async {
              await context.read<WineDataProvider>().deleteCustomer(id);
              if (ctx.mounted) Navigator.pop(ctx);
              if (context.mounted) {
                Navigator.pop(context, true);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Đã xóa khách hàng'), behavior: SnackBarBehavior.floating),
                );
              }
            },
            style: FilledButton.styleFrom(
              backgroundColor: Colors.red[400],
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
  }
}
