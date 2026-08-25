import 'package:flutter/material.dart';
import '../categories/categories_screen.dart';
import '../accounts/accounts_screen.dart';
import '../transactions/trash_screen.dart';
import 'beneficiaries_screen.dart';
import 'google_drive_screen.dart';
import 'notification_settings_screen.dart';
import 'backup_restore_screen.dart';
import 'import_screen.dart';
import 'export_excel_screen.dart';
import 'security_settings_screen.dart';
import 'module_manager_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  static const _green = Color(0xFF2E7D32);
  static const _darkText = Color(0xFF1A1A1A);
  static const _sectionTitle = Color(0xFF2E7D32);
  static const _bgColor = Color(0xFFF8F9FA);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bgColor,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              const Center(
                child: Padding(
                  padding: EdgeInsets.only(bottom: 20),
                  child: Text('Cài đặt', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: _darkText)),
                ),
              ),

              // 1. DỮ LIỆU
              _buildSectionTitle('1. DỮ LIỆU'),
              const SizedBox(height: 8),
              _buildCard(
                children: [
                  _buildNavItem(
                    context,
                    icon: Icons.category_rounded,
                    iconColor: _green,
                    iconBgColor: _green.withOpacity(0.1),
                    title: 'Danh mục',
                    subtitle: 'Quản lý danh mục chi tiêu',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CategoriesScreen())),
                  ),
                  _divider(),
                  _buildNavItem(
                    context,
                    icon: Icons.account_balance_wallet_rounded,
                    iconColor: const Color(0xFF1565C0),
                    iconBgColor: const Color(0xFF1565C0).withOpacity(0.1),
                    title: 'Phương thức thanh toán',
                    subtitle: 'Quản lý tài khoản, ví, thẻ...',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AccountsScreen())),
                  ),
                  _divider(),
                  _buildNavItem(
                    context,
                    icon: Icons.person_rounded,
                    iconColor: const Color(0xFF6A1B9A),
                    iconBgColor: const Color(0xFF6A1B9A).withOpacity(0.1),
                    title: 'Người nhận',
                    subtitle: 'Quản lý danh sách người nhận / đối tượng',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BeneficiariesScreen())),
                  ),
                  _divider(),
                  _buildNavItem(
                    context,
                    icon: Icons.delete_outline_rounded,
                    iconColor: const Color(0xFFD32F2F),
                    iconBgColor: const Color(0xFFD32F2F).withOpacity(0.1),
                    title: 'Thùng rác',
                    subtitle: 'Xem và khôi phục các giao dịch đã xóa',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TrashScreen())),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // 2. QUẢN LÝ MODULE
              _buildSectionTitle('2. QUẢN LÝ MODULE'),
              const SizedBox(height: 8),
              _buildCard(
                children: [
                  _buildNavItem(
                    context,
                    icon: Icons.widgets_rounded,
                    iconColor: _green,
                    iconBgColor: _green.withOpacity(0.1),
                    title: 'Quản lý Module',
                    subtitle: 'Bật / tắt các module hiển thị',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ModuleManagerScreen())),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // 3. ĐỒNG BỘ
              _buildSectionTitle('3. ĐỒNG BỘ'),
              const SizedBox(height: 8),
              _buildCard(
                children: [
                  _buildNavItem(
                    context,
                    icon: Icons.cloud_rounded,
                    iconColor: const Color(0xFF1565C0),
                    iconBgColor: const Color(0xFF1565C0).withOpacity(0.1),
                    title: 'Google Drive',
                    subtitle: 'Đồng bộ dữ liệu lên đám mây',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GoogleDriveScreen())),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // 4. THÔNG BÁO
              _buildSectionTitle('4. THÔNG BÁO'),
              const SizedBox(height: 8),
              _buildCard(
                children: [
                  _buildNavItem(
                    context,
                    icon: Icons.notifications_rounded,
                    iconColor: const Color(0xFFE65100),
                    iconBgColor: const Color(0xFFE65100).withOpacity(0.1),
                    title: 'Nhắc nhập chi tiêu',
                    subtitle: 'Thiết lập lịch nhắc nhập chi tiêu hàng ngày',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationSettingsScreen())),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // 5. IMPORT / EXPORT & BACKUP
              _buildSectionTitle('5. IMPORT / EXPORT & BACKUP'),
              const SizedBox(height: 8),
              _buildCard(
                children: [
                  _buildNavItem(
                    context,
                    icon: Icons.backup_rounded,
                    iconColor: const Color(0xFF00695C),
                    iconBgColor: const Color(0xFF00695C).withOpacity(0.1),
                    title: 'Import / Export & Backup',
                    subtitle: 'Nhập, xuất và sao lưu dữ liệu',
                    onTap: () => _showImportExportSheet(context),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // 6. BẢO MẬT
              _buildSectionTitle('6. BẢO MẬT'),
              const SizedBox(height: 8),
              _buildCard(
                children: [
                  _buildNavItem(
                    context,
                    icon: Icons.lock_rounded,
                    iconColor: const Color(0xFF37474F),
                    iconBgColor: const Color(0xFF37474F).withOpacity(0.1),
                    title: 'Bảo mật',
                    subtitle: 'PIN, vân tay, khóa ứng dụng và quyền riêng tư',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SecuritySettingsScreen())),
                  ),
                ],
              ),

              const SizedBox(height: 80), // Bottom padding for nav bar
            ],
          ),
        ),
      ),
    );
  }

  // ─── Section Title ─────────────────────────────────────────────────────────

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Text(
        title,
        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: _sectionTitle, letterSpacing: 0.3),
      ),
    );
  }

  // ─── Card Container ────────────────────────────────────────────────────────

  Widget _buildCard({required List<Widget> children}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(children: children),
    );
  }

  // ─── Nav Item (with chevron) ───────────────────────────────────────────────

  Widget _buildNavItem(
    BuildContext context, {
    required IconData icon,
    required Color iconColor,
    required Color iconBgColor,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: iconBgColor, borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, size: 20, color: iconColor),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: _darkText)),
                  const SizedBox(height: 2),
                  Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey[500]), maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, size: 22, color: Colors.grey[400]),
          ],
        ),
      ),
    );
  }

  // ─── Divider ───────────────────────────────────────────────────────────────

  Widget _divider() {
    return Padding(
      padding: const EdgeInsets.only(left: 70),
      child: Divider(height: 1, color: Colors.grey[100]),
    );
  }

  // ─── Import/Export Bottom Sheet ────────────────────────────────────────────

  void _showImportExportSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Import / Export & Backup', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                const SizedBox(height: 16),
                ListTile(
                  leading: const Icon(Icons.file_upload_outlined, color: _green),
                  title: const Text('Nhập dữ liệu (Import)'),
                  subtitle: const Text('Import từ file Excel/CSV', style: TextStyle(fontSize: 12)),
                  onTap: () {
                    Navigator.pop(ctx);
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const ImportScreen()));
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.file_download_outlined, color: _green),
                  title: const Text('Xuất dữ liệu (Export)'),
                  subtitle: const Text('Xuất dữ liệu ra file .xlsx', style: TextStyle(fontSize: 12)),
                  onTap: () {
                    Navigator.pop(ctx);
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const ExportExcelScreen()));
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.backup_outlined, color: _green),
                  title: const Text('Sao lưu & Khôi phục'),
                  subtitle: const Text('Backup/Restore dữ liệu cục bộ', style: TextStyle(fontSize: 12)),
                  onTap: () {
                    Navigator.pop(ctx);
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const BackupRestoreScreen()));
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
