import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Screen to configure which fields are visible/required in the Add Transaction form
class FieldConfigScreen extends StatefulWidget {
  const FieldConfigScreen({super.key});

  @override
  State<FieldConfigScreen> createState() => _FieldConfigScreenState();
}

class _FieldConfigScreenState extends State<FieldConfigScreen> {
  // Default field visibility settings
  Map<String, bool> _fieldVisibility = {
    'amount': true,
    'title': true,
    'datetime': true,
    'category': true,
    'account': true,
    'module': true,
    'note': true,
    'tags': true,
  };

  final Map<String, String> _fieldLabels = {
    'amount': 'Số tiền',
    'title': 'Tên giao dịch',
    'datetime': 'Thời gian',
    'category': 'Danh mục',
    'account': 'Tài khoản',
    'module': 'Module',
    'note': 'Ghi chú',
    'tags': 'Tag',
  };

  final Map<String, IconData> _fieldIcons = {
    'amount': Icons.attach_money,
    'title': Icons.edit_outlined,
    'datetime': Icons.access_time,
    'category': Icons.category_outlined,
    'account': Icons.account_balance_wallet_outlined,
    'module': Icons.widgets_outlined,
    'note': Icons.notes_outlined,
    'tags': Icons.tag,
  };

  // Fields that cannot be hidden (always required)
  final Set<String> _requiredFields = {'amount', 'title'};

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      for (final key in _fieldVisibility.keys) {
        _fieldVisibility[key] = prefs.getBool('field_visible_$key') ?? true;
      }
    });
  }

  Future<void> _saveSettings() async {
    final prefs = await SharedPreferences.getInstance();
    for (final entry in _fieldVisibility.entries) {
      await prefs.setBool('field_visible_${entry.key}', entry.value);
    }
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã lưu cấu hình'), behavior: SnackBarBehavior.floating),
      );
    }
  }

  void _showAddFieldDialog() {
    final nameController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Thêm trường mới'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Tên trường',
                hintText: 'Ví dụ: Số hóa đơn, Người nhận...',
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Trường mới sẽ hiển thị dưới dạng ô nhập văn bản trong form giao dịch.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.outline),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          FilledButton(
            onPressed: () {
              final name = nameController.text.trim();
              if (name.isEmpty) return;
              final key = 'custom_${name.toLowerCase().replaceAll(' ', '_')}';
              setState(() {
                _fieldVisibility[key] = true;
                _fieldLabels[key] = name;
                _fieldIcons[key] = Icons.text_fields;
              });
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Đã thêm trường "$name"'), behavior: SnackBarBehavior.floating),
              );
            },
            child: const Text('Thêm'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Cấu hình trường nhập'),
        actions: [
          TextButton(onPressed: _saveSettings, child: const Text('Lưu')),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              'Chọn các trường hiển thị khi nhập giao dịch. Trường bắt buộc không thể ẩn.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.outline),
            ),
          ),
          Expanded(
            child: ReorderableListView(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              onReorder: (oldIndex, newIndex) {
                if (newIndex > oldIndex) newIndex--;
                final keys = _fieldVisibility.keys.toList();
                final key = keys.removeAt(oldIndex);
                keys.insert(newIndex, key);
                final newMap = <String, bool>{};
                for (final k in keys) {
                  newMap[k] = _fieldVisibility[k]!;
                }
                setState(() => _fieldVisibility = newMap);
              },
              children: [
                for (final entry in _fieldVisibility.entries)
                  _FieldConfigTile(
                    key: ValueKey(entry.key),
                    fieldKey: entry.key,
                    label: _fieldLabels[entry.key] ?? entry.key,
                    icon: _fieldIcons[entry.key] ?? Icons.text_fields,
                    isVisible: entry.value,
                    isRequired: _requiredFields.contains(entry.key),
                    onChanged: (value) {
                      setState(() => _fieldVisibility[entry.key] = value);
                    },
                  ),
              ],
            ),
          ),
          // Add new field button
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _showAddFieldDialog,
                icon: const Icon(Icons.add),
                label: const Text('Thêm trường mới'),
              ),
            ),
          ),
          // Info box
          Padding(
            padding: const EdgeInsets.all(16),
            child: Card(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, size: 18, color: Theme.of(context).colorScheme.outline),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Kéo để sắp xếp thứ tự hiển thị. Bật/tắt để ẩn/hiện trường.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.outline),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FieldConfigTile extends StatelessWidget {
  final String fieldKey;
  final String label;
  final IconData icon;
  final bool isVisible;
  final bool isRequired;
  final ValueChanged<bool> onChanged;

  const _FieldConfigTile({
    super.key,
    required this.fieldKey,
    required this.label,
    required this.icon,
    required this.isVisible,
    required this.isRequired,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 4),
      child: ListTile(
        leading: Icon(icon, color: isVisible
            ? Theme.of(context).colorScheme.primary
            : Theme.of(context).colorScheme.outline),
        title: Text(label),
        subtitle: isRequired
            ? Text('Bắt buộc', style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12))
            : null,
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Switch(
              value: isVisible,
              onChanged: isRequired ? null : onChanged,
            ),
            const Icon(Icons.drag_handle),
          ],
        ),
      ),
    );
  }
}
