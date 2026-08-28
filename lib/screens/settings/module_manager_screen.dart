import 'dart:math';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../models/app_module.dart';
import '../../providers/module_provider.dart';
import '../../utils/icon_helper.dart';
import '../../utils/color_helper.dart';
import '../../services/auto_sync.dart';
import '../../database/database_helper.dart';

/// System module IDs that cannot be deleted
const _systemModuleIds = [
  'mod_chitieu', 'mod_shopee', 'mod_vang', 'mod_nhatro',
  'mod_creditcard', 'mod_ruou', 'mod_ruou_products',
  'mod_ruou_customers', 'mod_ruou_inventory',
];

/// Module Manager — Create/Edit/Delete filter modules.
/// New modules are "views" of Chi tiêu data, filtered by linkedModuleId.
/// They do NOT have their own fields, categories, or records table.
class ModuleManagerScreen extends StatefulWidget {
  const ModuleManagerScreen({super.key});

  @override
  State<ModuleManagerScreen> createState() => _ModuleManagerScreenState();
}

class _ModuleManagerScreenState extends State<ModuleManagerScreen> {
  @override
  void initState() {
    super.initState();
    context.read<ModuleProvider>().loadModules();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        title: const Text('Quản lý Module', style: TextStyle(fontWeight: FontWeight.w600)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1A1A1A),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline, color: Color(0xFF2E7D32)),
            onPressed: _showCreateDialog,
            tooltip: 'Thêm module',
          ),
        ],
      ),
      body: Consumer<ModuleProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading) return const Center(child: CircularProgressIndicator());
          final modules = provider.modules;
          if (modules.isEmpty) return const Center(child: Text('Chưa có module nào'));
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: modules.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) => _ModuleListItem(
              module: modules[index],
              onEdit: () => _showEditDialog(modules[index]),
              onToggle: () => _toggleModule(modules[index]),
              onDelete: _systemModuleIds.contains(modules[index].id) ? null : () => _deleteModule(modules[index]),
            ),
          );
        },
      ),
    );
  }

  void _showCreateDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _CreateModuleSheet(
        onCreated: (module) {
          final provider = context.read<ModuleProvider>();
          provider.addModule(module);
          _persistAndSync();
          Navigator.pop(context);
        },
      ),
    );
  }

  void _showEditDialog(AppModule module) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _EditModuleSheet(
        module: module,
        onSaved: (updated) {
          final provider = context.read<ModuleProvider>();
          provider.updateModule(updated);
          _persistAndSync();
          Navigator.pop(context);
        },
      ),
    );
  }

  void _toggleModule(AppModule module) {
    final provider = context.read<ModuleProvider>();
    provider.toggleModule(module.id);
    _persistAndSync();
  }

  Future<void> _deleteModule(AppModule module) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa module?'),
        content: Text(
          'Module "${module.name}" sẽ bị xóa.\n'
          'Giao dịch Chi tiêu đã gắn module này sẽ vẫn còn trong Chi tiêu.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Xóa', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    final provider = context.read<ModuleProvider>();
    provider.deleteModule(module.id);
    // Write a tombstone so the deletion propagates across devices (sync merge
    // would otherwise re-add the module from remote).
    await _writeModuleTombstone(module.id);
    // Records are NOT deleted — they remain in Chi tiêu with linkedModuleId
    // The linkedModuleId on records becomes orphaned but harmless
    _persistAndSync();
  }

  /// Append {id, deletedAt} to the persisted deletedModuleIds tombstone list.
  Future<void> _writeModuleTombstone(String moduleId) async {
    final now = DateTime.now().toUtc().toIso8601String();
    final existing = await DatabaseHelper.instance.getAppData('deletedModuleIds');
    final list = <Map<String, dynamic>>[];
    if (existing is List) {
      for (final t in existing) {
        if (t is Map && t['id'] != null && t['id'] != moduleId) {
          list.add({'id': t['id'], 'deletedAt': t['deletedAt']});
        }
      }
    }
    list.add({'id': moduleId, 'deletedAt': now});
    await DatabaseHelper.instance.setAppData('deletedModuleIds', list);
  }

  void _persistAndSync() {
    final provider = context.read<ModuleProvider>();
    final modulesJson = provider.modules.map((m) => <String, dynamic>{
      'id': m.id,
      'name': m.name,
      'icon': m.icon,
      'color': m.color,
      'sortOrder': m.sortOrder,
      'isDefault': m.isDefault,
      'isActive': m.isActive,
      'isVisible': m.isActive,
    }).toList();
    DatabaseHelper.instance.setAppData('modules', modulesJson);
    AutoSync.instance.notifyDataChanged();
    setState(() {});
  }
}

// ─── Module List Item ─────────────────────────────────────────────────────────

class _ModuleListItem extends StatelessWidget {
  final AppModule module;
  final VoidCallback onEdit;
  final VoidCallback onToggle;
  final VoidCallback? onDelete;

  const _ModuleListItem({
    required this.module,
    required this.onEdit,
    required this.onToggle,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final color = ColorHelper.getColor(module.color);
    final isSystem = _systemModuleIds.contains(module.id);
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: module.isActive ? color.withOpacity(0.2) : Colors.grey[200]!),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: Container(
          width: 40, height: 40,
          decoration: BoxDecoration(
            color: (module.isActive ? color : Colors.grey).withOpacity(0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(IconHelper.getIcon(module.icon), color: module.isActive ? color : Colors.grey, size: 20),
        ),
        title: Text(module.name, style: TextStyle(
          fontWeight: FontWeight.w600,
          color: module.isActive ? const Color(0xFF1A1A1A) : Colors.grey,
        )),
        subtitle: Text(
          isSystem ? 'Module hệ thống' : 'Filter view — Chi tiêu',
          style: TextStyle(fontSize: 12, color: Colors.grey[500]),
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Transform.scale(
              scale: 0.8,
              child: Switch(
                value: module.isActive,
                onChanged: (_) => onToggle(),
                activeColor: const Color(0xFF2E7D32),
              ),
            ),
            PopupMenuButton<String>(
              icon: Icon(Icons.more_vert, size: 20, color: Colors.grey[400]),
              onSelected: (value) {
                if (value == 'edit') onEdit();
                if (value == 'delete' && onDelete != null) onDelete!();
              },
              itemBuilder: (_) => [
                if (!isSystem) const PopupMenuItem(value: 'edit', child: Text('Chỉnh sửa')),
                if (onDelete != null)
                  const PopupMenuItem(value: 'delete', child: Text('Xóa', style: TextStyle(color: Colors.red))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Create Module Sheet ──────────────────────────────────────────────────────

class _CreateModuleSheet extends StatefulWidget {
  final Function(AppModule) onCreated;
  const _CreateModuleSheet({required this.onCreated});

  @override
  State<_CreateModuleSheet> createState() => _CreateModuleSheetState();
}

class _CreateModuleSheetState extends State<_CreateModuleSheet> {
  final _nameCtrl = TextEditingController();
  String _selectedIcon = '';
  Color _selectedColor = Colors.blue;

  @override
  void initState() {
    super.initState();
    _randomize();
  }

  void _randomize() {
    final rng = Random();
    final icons = IconHelper.allIconNames;
    _selectedIcon = icons[rng.nextInt(icons.length)];
    _selectedColor = ColorHelper.availableColors[rng.nextInt(ColorHelper.availableColors.length)];
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 20),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            const Text('Thêm Module', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('Module mới là bộ lọc giao dịch Chi tiêu.', style: TextStyle(fontSize: 12, color: Colors.grey[500])),
            const SizedBox(height: 20),

            // Name
            TextField(
              controller: _nameCtrl,
              decoration: InputDecoration(
                labelText: 'Tên module',
                hintText: 'Ví dụ: Xe máy, Du lịch, Học tập...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true, fillColor: Colors.grey[50],
              ),
              autofocus: true,
            ),
            const SizedBox(height: 16),

            // Icon picker
            const Text('Icon', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: IconHelper.allIconNames.map((name) {
                  final selected = name == _selectedIcon;
                  return GestureDetector(
                    onTap: () => setState(() => _selectedIcon = name),
                    child: Container(
                      width: 44, height: 44,
                      margin: const EdgeInsets.only(right: 8),
                      decoration: BoxDecoration(
                        color: selected ? _selectedColor.withOpacity(0.15) : Colors.grey[100],
                        borderRadius: BorderRadius.circular(10),
                        border: selected ? Border.all(color: _selectedColor, width: 2) : null,
                      ),
                      child: Icon(IconHelper.getIcon(name), size: 20, color: selected ? _selectedColor : Colors.grey[600]),
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 16),

            // Color picker
            const Text('Màu sắc', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8, runSpacing: 8,
              children: ColorHelper.availableColors.map((c) {
                final selected = c.value == _selectedColor.value;
                return GestureDetector(
                  onTap: () => setState(() => _selectedColor = c),
                  child: Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      color: c, shape: BoxShape.circle,
                      border: selected ? Border.all(color: Colors.white, width: 3) : null,
                      boxShadow: selected ? [BoxShadow(color: c.withOpacity(0.4), blurRadius: 6)] : null,
                    ),
                    child: selected ? const Icon(Icons.check, color: Colors.white, size: 18) : null,
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),

            // Create button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _create,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2E7D32),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Tạo Module', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _create() {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Vui lòng nhập tên module')));
      return;
    }
    final module = AppModule(
      id: 'mod_${const Uuid().v4().substring(0, 8)}',
      name: name,
      icon: _selectedIcon,
      color: ColorHelper.toHex(_selectedColor),
      sortOrder: 99,
      isDefault: false,
      isActive: true,
    );
    widget.onCreated(module);
  }
}

// ─── Edit Module Sheet ────────────────────────────────────────────────────────

class _EditModuleSheet extends StatefulWidget {
  final AppModule module;
  final Function(AppModule) onSaved;
  const _EditModuleSheet({required this.module, required this.onSaved});

  @override
  State<_EditModuleSheet> createState() => _EditModuleSheetState();
}

class _EditModuleSheetState extends State<_EditModuleSheet> {
  late final TextEditingController _nameCtrl;
  late String _selectedIcon;
  late Color _selectedColor;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.module.name);
    _selectedIcon = widget.module.icon;
    _selectedColor = ColorHelper.getColor(widget.module.color);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 20),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            Text('Chỉnh sửa: ${widget.module.name}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 20),

            TextField(
              controller: _nameCtrl,
              decoration: InputDecoration(
                labelText: 'Tên module',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true, fillColor: Colors.grey[50],
              ),
            ),
            const SizedBox(height: 16),

            const Text('Icon', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: IconHelper.allIconNames.map((name) {
                  final selected = name == _selectedIcon;
                  return GestureDetector(
                    onTap: () => setState(() => _selectedIcon = name),
                    child: Container(
                      width: 44, height: 44,
                      margin: const EdgeInsets.only(right: 8),
                      decoration: BoxDecoration(
                        color: selected ? _selectedColor.withOpacity(0.15) : Colors.grey[100],
                        borderRadius: BorderRadius.circular(10),
                        border: selected ? Border.all(color: _selectedColor, width: 2) : null,
                      ),
                      child: Icon(IconHelper.getIcon(name), size: 20, color: selected ? _selectedColor : Colors.grey[600]),
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 16),

            const Text('Màu sắc', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8, runSpacing: 8,
              children: ColorHelper.availableColors.map((c) {
                final selected = c.value == _selectedColor.value;
                return GestureDetector(
                  onTap: () => setState(() => _selectedColor = c),
                  child: Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      color: c, shape: BoxShape.circle,
                      border: selected ? Border.all(color: Colors.white, width: 3) : null,
                      boxShadow: selected ? [BoxShadow(color: c.withOpacity(0.4), blurRadius: 6)] : null,
                    ),
                    child: selected ? const Icon(Icons.check, color: Colors.white, size: 18) : null,
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2E7D32),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Lưu thay đổi', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _save() {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tên không được để trống')));
      return;
    }
    widget.onSaved(widget.module.copyWith(
      name: name,
      icon: _selectedIcon,
      color: ColorHelper.toHex(_selectedColor),
      updatedAt: DateTime.now(),
    ));
  }
}
