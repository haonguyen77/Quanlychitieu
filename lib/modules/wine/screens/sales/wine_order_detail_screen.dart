import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/wine_data_provider.dart';
import 'wine_order_form_screen.dart';

/// Material 3 minimal wine order detail screen.
/// Read-only view with edit/delete actions.
class WineOrderDetailScreen extends StatelessWidget {
  final Map<String, dynamic> order;
  const WineOrderDetailScreen({super.key, required this.order});

  static const _purple = Color(0xFF6C2BD9);
  static const _purpleLight = Color(0xFFF3EAFF);
  static const _navy = Color(0xFF101B4D);
  static const _border = Color(0xFFEEEEEE);
  static const _bg = Color(0xFFF8F9FA);

  @override
  Widget build(BuildContext context) {
    final nf = NumberFormat('#,###', 'vi');
    final customerName = order['customer_name'] as String? ?? 'Khách lẻ';
    final phone = order['customer_phone'] as String? ?? '';
    final address = [order['customer_address'], order['customer_district'], order['customer_city']]
        .where((s) => s != null && s.toString().isNotEmpty).join(', ');
    final dateStr = order['order_date'] as String? ?? '';
    DateTime date;
    try { date = DateTime.parse(dateStr); } catch (_) { date = DateTime.now(); }
    final total = _toDouble(order['total_amount']);
    final shipFee = _toDouble(order['ship_fee']);
    final note1 = order['note1'] as String? ?? '';
    final note2 = order['note2'] as String? ?? '';
    final productLines = _getProductLines();

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
        title: const Text('Chi tiết đơn hàng', style: TextStyle(color: _navy, fontWeight: FontWeight.w600, fontSize: 17)),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined, color: _purple, size: 22),
            tooltip: 'Sửa',
            onPressed: () async {
              final result = await Navigator.push(context, MaterialPageRoute(
                builder: (_) => WineOrderFormScreen(editOrderId: order['id'] as String),
              ));
              if (context.mounted) Navigator.pop(context, true);
            },
          ),
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
            // ─── Amount Hero ──────────────────────────────────────
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF6C2BD9), Color(0xFF9B59B6)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(color: _purple.withOpacity(0.2), blurRadius: 20, offset: const Offset(0, 8)),
                ],
              ),
              child: Column(
                children: [
                  Text('${nf.format(total.toInt())} ₫',
                      style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: Colors.white)),
                  const SizedBox(height: 6),
                  Text(customerName, style: TextStyle(fontSize: 14, color: Colors.white.withOpacity(0.9))),
                  const SizedBox(height: 4),
                  Text(DateFormat('dd/MM/yyyy').format(date),
                      style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.7))),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // ─── Customer Info ────────────────────────────────────
            _card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _sectionTitle('Khách hàng'),
                  const SizedBox(height: 12),
                  _infoRow(Icons.person_outline, 'Tên', customerName),
                  if (phone.isNotEmpty) ...[_divider(), _infoRow(Icons.phone_outlined, 'SĐT', phone)],
                  if (address.isNotEmpty) ...[_divider(), _infoRow(Icons.location_on_outlined, 'Địa chỉ', address)],
                ],
              ),
            ),
            const SizedBox(height: 12),

            // ─── Products ─────────────────────────────────────────
            _card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _sectionTitle('Sản phẩm'),
                  const SizedBox(height: 12),
                  ...productLines.asMap().entries.map((entry) {
                    final i = entry.key;
                    final item = entry.value;
                    final name = item['productName'] as String? ?? item['productSku'] as String? ?? 'SP';
                    final qty = int.tryParse(item['quantity']?.toString() ?? '0') ?? 0;
                    final price = _toDouble(item['price']);
                    final lineTotal = qty * price;
                    return Container(
                      margin: EdgeInsets.only(top: i > 0 ? 10 : 0),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: _purpleLight.withOpacity(0.5),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 28, height: 28,
                            decoration: BoxDecoration(color: _purple.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                            child: Center(child: Text('${i + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: _purple))),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: _navy)),
                                const SizedBox(height: 2),
                                Text('SL: $qty × ${nf.format(price.toInt())}₫', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                              ],
                            ),
                          ),
                          Text('${nf.format(lineTotal.toInt())}₫', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _purple)),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // ─── Payment Summary ──────────────────────────────────
            _card(
              child: Column(
                children: [
                  _summaryRow('Tổng tiền hàng', '${nf.format(total.toInt())}₫'),
                  _divider(),
                  _summaryRow('Phí ship', '${nf.format(shipFee.toInt())}₫'),
                  _divider(),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Thanh toán', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _navy)),
                        Text('${nf.format((total + shipFee).toInt())}₫',
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: _purple)),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // ─── Notes ────────────────────────────────────────────
            if (note1.isNotEmpty || note2.isNotEmpty) ...[
              const SizedBox(height: 12),
              _card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (note1.isNotEmpty) ...[
                      Row(children: [
                        Icon(Icons.notes_outlined, size: 16, color: Colors.grey[500]),
                        const SizedBox(width: 8),
                        Expanded(child: Text(note1, style: const TextStyle(fontSize: 13, color: _navy))),
                      ]),
                    ],
                    if (note1.isNotEmpty && note2.isNotEmpty) const SizedBox(height: 8),
                    if (note2.isNotEmpty) ...[
                      Row(children: [
                        Icon(Icons.note_alt_outlined, size: 16, color: Colors.grey[500]),
                        const SizedBox(width: 8),
                        Expanded(child: Text(note2, style: TextStyle(fontSize: 12, color: Colors.grey[600]))),
                      ]),
                    ],
                  ],
                ),
              ),
            ],

            const SizedBox(height: 24),
            // ─── Delete Button ────────────────────────────────────
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _confirmDelete(context),
                icon: Icon(Icons.delete_outline, color: Colors.red[400], size: 18),
                label: Text('Xóa đơn hàng', style: TextStyle(color: Colors.red[400])),
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

  // ─── Helpers ──────────────────────────────────────────────────────────────

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

  Widget _summaryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: Colors.grey[600])),
          Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: _navy)),
        ],
      ),
    );
  }

  Widget _divider() => Divider(height: 1, color: Colors.grey[100]);

  List<Map<String, dynamic>> _getProductLines() {
    final plRaw = order['product_lines'];
    List<Map<String, dynamic>> lines = [];
    if (plRaw != null && plRaw is String && plRaw.isNotEmpty) {
      try { lines = (List<dynamic>.from(jsonDecode(plRaw))).cast<Map<String, dynamic>>(); } catch (_) {}
    }
    if (lines.isEmpty && (order['product_name'] != null || order['product_sku'] != null)) {
      lines = [{'productName': order['product_name'], 'productSku': order['product_sku'], 'quantity': order['quantity'], 'price': order['price']}];
    }
    return lines;
  }

  double _toDouble(dynamic v) {
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  void _confirmDelete(BuildContext context) {
    final id = order['id'] as String? ?? '';
    if (id.isEmpty) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Xóa đơn hàng', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 17)),
        content: const Text('Đơn hàng sẽ bị xóa. Tồn kho sẽ được hoàn lại.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text('Hủy', style: TextStyle(color: Colors.grey[600]))),
          FilledButton(
            onPressed: () async {
              await context.read<WineDataProvider>().deleteOrder(id);
              if (ctx.mounted) Navigator.pop(ctx);
              if (context.mounted) {
                Navigator.pop(context, true);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Đã xóa đơn hàng'), behavior: SnackBarBehavior.floating),
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
