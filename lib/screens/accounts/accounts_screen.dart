import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/account.dart';
import '../../providers/account_provider.dart';
import '../../utils/formatters.dart';
import '../../utils/icon_helper.dart';
import '../../utils/color_helper.dart';
import 'add_account_screen.dart';
import 'transfer_screen.dart';

/// Material 3 minimal accounts/payment methods screen.
class AccountsScreen extends StatefulWidget {
  const AccountsScreen({super.key});

  @override
  State<AccountsScreen> createState() => _AccountsScreenState();
}

class _AccountsScreenState extends State<AccountsScreen> {
  static const _purple = Color(0xFF6C2BD9);
  static const _purpleLight = Color(0xFFF3EAFF);
  static const _navy = Color(0xFF101B4D);
  static const _bg = Color(0xFFF8F9FA);
  static const _border = Color(0xFFEEEEEE);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AccountProvider>().loadAccounts();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: _navy), onPressed: () => Navigator.pop(context)),
        title: const Text('Phương thức thanh toán', style: TextStyle(color: _navy, fontWeight: FontWeight.w600, fontSize: 16)),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.swap_horiz, color: _purple, size: 22),
            tooltip: 'Chuyển tiền',
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TransferScreen())),
          ),
        ],
      ),
      body: Consumer<AccountProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) return const Center(child: CircularProgressIndicator(color: _purple));

          return SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ─── Total Balance Hero ─────────────────────────────
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6C2BD9), Color(0xFF9B59B6)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [BoxShadow(color: _purple.withOpacity(0.2), blurRadius: 20, offset: const Offset(0, 8))],
                  ),
                  child: Column(
                    children: [
                      Text('Tổng tài sản', style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.8))),
                      const SizedBox(height: 8),
                      Text(
                        Formatters.currency(provider.totalBalance),
                        style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      const SizedBox(height: 4),
                      Text('${provider.accounts.length} tài khoản', style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.7))),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // ─── Account List ───────────────────────────────────
                Row(
                  children: [
                    Text('Danh sách', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey[500], letterSpacing: 0.5)),
                    const Spacer(),
                    GestureDetector(
                      onTap: () async {
                        await Navigator.push(context, MaterialPageRoute(builder: (_) => const AddAccountScreen()));
                        if (mounted) context.read<AccountProvider>().loadAccounts();
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(color: _purpleLight, borderRadius: BorderRadius.circular(8)),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          const Icon(Icons.add, size: 14, color: _purple),
                          const SizedBox(width: 4),
                          const Text('Thêm', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: _purple)),
                        ]),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                if (provider.accounts.isEmpty)
                  _emptyState()
                else
                  ...provider.accounts.map((acc) => _accountCard(acc)),

                const SizedBox(height: 32),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _accountCard(Account account) {
    final color = ColorHelper.getColor(account.color);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: InkWell(
        onTap: () async {
          await Navigator.push(context, MaterialPageRoute(builder: (_) => AddAccountScreen(editAccount: account)));
          if (mounted) context.read<AccountProvider>().loadAccounts();
        },
        child: Row(
          children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(12)),
              child: Icon(IconHelper.getIcon(account.icon), color: color, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(account.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: _navy)),
                  if (!account.includeInTotal)
                    Container(
                      margin: const EdgeInsets.only(top: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(4)),
                      child: Text('Không tính vào tổng', style: TextStyle(fontSize: 9, color: Colors.grey[500])),
                    ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  Formatters.currency(account.currentBalance),
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: account.currentBalance >= 0 ? const Color(0xFF16A34A) : Colors.red[400]),
                ),
              ],
            ),
            const SizedBox(width: 4),
            PopupMenuButton<String>(
              icon: Icon(Icons.more_vert, size: 18, color: Colors.grey[400]),
              onSelected: (value) {
                if (value == 'edit') {
                  Navigator.push(context, MaterialPageRoute(builder: (_) => AddAccountScreen(editAccount: account)));
                } else if (value == 'delete') {
                  _confirmDelete(account);
                }
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'edit', child: Text('Sửa')),
                PopupMenuItem(value: 'delete', child: Text('Xóa', style: TextStyle(color: Colors.red))),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyState() {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: _border)),
      child: Center(
        child: Column(children: [
          Icon(Icons.account_balance_wallet_outlined, size: 48, color: Colors.grey[300]),
          const SizedBox(height: 12),
          Text('Chưa có tài khoản', style: TextStyle(color: Colors.grey[500])),
        ]),
      ),
    );
  }

  void _confirmDelete(Account account) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Xóa tài khoản', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 17)),
        content: Text('Bạn có chắc muốn xóa "${account.name}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text('Hủy', style: TextStyle(color: Colors.grey[600]))),
          FilledButton(
            onPressed: () {
              context.read<AccountProvider>().deleteAccount(account.id);
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Đã xóa "${account.name}"'), behavior: SnackBarBehavior.floating));
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red[400], shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
  }
}
