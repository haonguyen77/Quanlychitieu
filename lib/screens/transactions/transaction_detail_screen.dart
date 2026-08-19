import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/transaction.dart';
import '../../providers/transaction_provider.dart';
import '../../utils/formatters.dart';
import '../../widgets/image_gallery_viewer.dart';
import 'add_transaction_screen.dart';

/// Material 3 minimal transaction detail screen.
/// Purple accent, soft rounded cards, clean layout.
class TransactionDetailScreen extends StatelessWidget {
  final Transaction transaction;
  const TransactionDetailScreen({super.key, required this.transaction});

  static const _purple = Color(0xFF6C2BD9);
  static const _purpleLight = Color(0xFFF3EAFF);
  static const _navy = Color(0xFF101B4D);
  static const _border = Color(0xFFEEEEEE);
  static const _bg = Color(0xFFF8F9FA);

  @override
  Widget build(BuildContext context) {
    final isExpense = transaction.isExpense;

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
        title: const Text('Chi tiết giao dịch', style: TextStyle(color: _navy, fontWeight: FontWeight.w600, fontSize: 17)),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined, color: _purple, size: 22),
            tooltip: 'Sửa',
            onPressed: () => _onEdit(context),
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
            // ─── Amount Hero Card ─────────────────────────────────
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: isExpense
                      ? [const Color(0xFFFF6B6B), const Color(0xFFEE5A24)]
                      : [const Color(0xFF2ED573), const Color(0xFF17C0EB)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: (isExpense ? Colors.red : Colors.green).withOpacity(0.2),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(
                      isExpense ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
                      color: Colors.white, size: 24,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    '${isExpense ? '-' : '+'}${Formatters.currency(transaction.amount)}',
                    style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    transaction.title,
                    style: TextStyle(fontSize: 15, color: Colors.white.withOpacity(0.9)),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    Formatters.date(transaction.date),
                    style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.7)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // ─── Info Card ────────────────────────────────────────
            _card(
              child: Column(
                children: [
                  _infoRow(Icons.calendar_today_outlined, 'Ngày', Formatters.date(transaction.date)),
                  _divider(),
                  _infoRow(Icons.category_outlined, 'Danh mục', transaction.categoryName ?? 'Không phân loại'),
                  _divider(),
                  _infoRow(Icons.account_balance_wallet_outlined, 'Thanh toán', transaction.accountName ?? '-'),
                  _divider(),
                  _infoRow(Icons.widgets_outlined, 'Module', transaction.moduleName ?? '-'),
                  if (transaction.beneficiary != null && transaction.beneficiary!.isNotEmpty) ...[
                    _divider(),
                    _infoRow(Icons.person_outline, 'Người nhận', transaction.beneficiary!),
                  ],
                  if (transaction.event != null && transaction.event!.isNotEmpty) ...[
                    _divider(),
                    _infoRow(Icons.event_outlined, 'Sự kiện', transaction.event!),
                  ],
                  if (transaction.store != null && transaction.store!.isNotEmpty) ...[
                    _divider(),
                    _infoRow(Icons.store_outlined, 'Cửa hàng', transaction.store!),
                  ],
                  if (transaction.quantity > 1) ...[
                    _divider(),
                    _infoRow(Icons.inventory_2_outlined, 'Số lượng', '${transaction.quantity}'),
                  ],
                  if (transaction.warrantyMonths != null && transaction.warrantyMonths! > 0) ...[
                    _divider(),
                    _infoRow(Icons.verified_user_outlined, 'Bảo hành', '${transaction.warrantyMonths} tháng'),
                  ],
                  if (transaction.warrantyDate != null) ...[
                    _divider(),
                    _infoRow(Icons.event_busy_outlined, 'Hết BH', Formatters.date(transaction.warrantyDate!)),
                  ],
                  if (transaction.tags != null && transaction.tags!.isNotEmpty) ...[
                    _divider(),
                    _infoRow(Icons.tag, 'Tag', transaction.tags!),
                  ],
                ],
              ),
            ),

            // ─── Note Card ────────────────────────────────────────
            if (transaction.note != null && transaction.note!.isNotEmpty) ...[
              const SizedBox(height: 12),
              _card(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.notes_outlined, size: 18, color: Colors.grey[500]),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Ghi chú', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                          const SizedBox(height: 4),
                          Text(transaction.note!, style: const TextStyle(fontSize: 14, color: _navy, height: 1.4)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // ─── Images Card ──────────────────────────────────────
            if (transaction.images != null && transaction.images!.isNotEmpty) ...[
              const SizedBox(height: 12),
              _card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.photo_library_outlined, size: 18, color: _purple),
                        const SizedBox(width: 8),
                        Text('Ảnh đính kèm (${transaction.imageList.length})',
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: _navy)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 100,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: transaction.imageList.length,
                        itemBuilder: (context, index) {
                          final path = transaction.imageList[index];
                          return Padding(
                            padding: const EdgeInsets.only(right: 10),
                            child: GestureDetector(
                              onTap: () => _showFullImage(context, path),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: Image.file(
                                  File(path),
                                  width: 100, height: 100,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => Container(
                                    width: 100, height: 100,
                                    decoration: BoxDecoration(
                                      color: _purpleLight,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Icon(Icons.broken_image_outlined, color: _purple, size: 28),
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 24),

            // ─── Action Buttons ───────────────────────────────────
            Row(
              children: [
                Expanded(
                  child: _actionButton(
                    icon: Icons.edit_outlined,
                    label: 'Sửa',
                    color: _purple,
                    filled: true,
                    onTap: () => _onEdit(context),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _actionButton(
                    icon: Icons.delete_outline,
                    label: 'Xóa',
                    color: Colors.red[400]!,
                    filled: false,
                    onTap: () => _confirmDelete(context),
                  ),
                ),
              ],
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

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(color: _purpleLight, borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, size: 16, color: _purple),
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 90,
            child: Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[500])),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: _navy),
                textAlign: TextAlign.right),
          ),
        ],
      ),
    );
  }

  Widget _divider() => Divider(height: 1, color: Colors.grey[100]);

  Widget _actionButton({
    required IconData icon,
    required String label,
    required Color color,
    required bool filled,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: filled ? color : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.5)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: filled ? Colors.white : color),
            const SizedBox(width: 8),
            Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: filled ? Colors.white : color)),
          ],
        ),
      ),
    );
  }

  void _onEdit(BuildContext context) async {
    final result = await Navigator.push(context, MaterialPageRoute(
      builder: (_) => AddTransactionScreen(editTransaction: transaction),
    ));
    if (result == true && context.mounted) {
      Navigator.pop(context, true);
    }
  }

  void _showFullImage(BuildContext context, String path) {
    final images = transaction.imageList;
    final index = images.indexOf(path);
    ImageGalleryViewer.show(
      context,
      imagePaths: images,
      initialIndex: index >= 0 ? index : 0,
    );
  }

  void _confirmDelete(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Xóa giao dịch', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 17)),
        content: Text('Bạn có chắc muốn xóa "${transaction.title}"?\n\nGiao dịch sẽ được chuyển vào thùng rác.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Hủy', style: TextStyle(color: Colors.grey[600])),
          ),
          FilledButton(
            onPressed: () {
              context.read<TransactionProvider>().deleteTransaction(transaction.id);
              Navigator.pop(ctx);
              Navigator.pop(context, true);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Đã xóa giao dịch'), behavior: SnackBarBehavior.floating),
              );
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
