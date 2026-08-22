import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/module_provider.dart';
import '../../utils/icon_helper.dart';
import '../../utils/color_helper.dart';
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
              _buildModuleSection(context),
              const SizedBox(height: 8),
              // Module Manager link
              GestureDetector(
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ModuleManagerScreen())),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey[200]!),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.settings_applications, size: 18, color: _green),
                      const SizedBox(width: 10),
                      const Expanded(child: Text('Quản lý Module nâng cao', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500))),
                      Icon(Icons.chevron_right, size: 18, color: Colors.grey[400]),
                    ],
                  ),
                ),
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

  // ─── Module Section (Grid 2 columns with switches) ─────────────────────────

  Widget _buildModuleSection(BuildContext context) {
    return Consumer<ModuleProvider>(
      builder: (context, provider, child) {
        final modules = provider.modules;
        if (modules.isEmpty) {
          // Trigger load
          WidgetsBinding.instance.addPostFrameCallback((_) => provider.loadModules());
          return _buildCard(children: [
            const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator())),
          ]);
        }

        return Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Grid 2 columns
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: 2.8,
                ),
                itemCount: modules.length,
                itemBuilder: (context, index) {
                  final module = modules[index];
                  return _buildModuleToggle(context, module, provider);
                },
              ),
              const SizedBox(height: 12),
              Text(
                'Tắt module sẽ ẩn khỏi menu nhưng dữ liệu vẫn được giữ nguyên.',
                style: TextStyle(fontSize: 11, color: Colors.grey[500], fontStyle: FontStyle.italic),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildModuleToggle(BuildContext context, dynamic module, ModuleProvider provider) {
    final iconData = _getModuleIcon(module.id, module.icon);
    final color = _getModuleColor(module.id, module.color);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: module.isActive ? color.withOpacity(0.05) : Colors.grey[50],
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: module.isActive ? color.withOpacity(0.2) : Colors.grey[200]!, width: 1),
      ),
      child: Row(
        children: [
          Icon(iconData, size: 18, color: module.isActive ? color : Colors.grey[400]),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              module.name,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: module.isActive ? _darkText : Colors.grey[500]),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Transform.scale(
            scale: 0.7,
            child: Switch(
              value: module.isActive,
              onChanged: (_) => provider.toggleModule(module.id),
              activeColor: _green,
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
        ],
      ),
    );
  }

  IconData _getModuleIcon(String moduleId, [String? iconName]) {
    switch (moduleId) {
      case 'mod_chitieu': return Icons.shopping_cart_rounded;
      case 'mod_shopee': return Icons.shopping_bag_rounded;
      case 'mod_vang': return Icons.diamond_rounded;
      case 'mod_nhatro': return Icons.home_rounded;
      case 'mod_creditcard': return Icons.credit_card_rounded;
      case 'mod_ruou': return Icons.liquor_rounded;
      case 'mod_ruou_products': return Icons.inventory_2_rounded;
      case 'mod_ruou_customers': return Icons.people_rounded;
      case 'mod_ruou_inventory': return Icons.warehouse_rounded;
      default: return IconHelper.getIcon(iconName ?? 'other');
    }
  }

  Color _getModuleColor(String moduleId, [String? colorHex]) {
    switch (moduleId) {
      case 'mod_chitieu': return _green;
      case 'mod_shopee': return const Color(0xFFEE4D2D);
      case 'mod_vang': return const Color(0xFFFFB300);
      case 'mod_nhatro': return const Color(0xFF1565C0);
      case 'mod_creditcard': return const Color(0xFF37474F);
      case 'mod_ruou': return const Color(0xFF6A1B9A);
      case 'mod_ruou_products': return const Color(0xFF8E24AA);
      case 'mod_ruou_customers': return const Color(0xFF5C6BC0);
      case 'mod_ruou_inventory': return const Color(0xFF00897B);
      default: return ColorHelper.getColor(colorHex ?? '#607D8B');
    }
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
