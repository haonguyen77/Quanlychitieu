import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../models/app_module.dart';
import '../../providers/module_provider.dart';
import '../../utils/icon_helper.dart';
import '../../utils/color_helper.dart';

class AddModuleScreen extends StatefulWidget {
  final AppModule? editModule;

  const AddModuleScreen({super.key, this.editModule});

  @override
  State<AddModuleScreen> createState() => _AddModuleScreenState();
}

class _AddModuleScreenState extends State<AddModuleScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _uuid = const Uuid();

  String _selectedIcon = 'other';
  String _selectedColor = '#2196F3';
  bool _isLoading = false;

  bool get isEditing => widget.editModule != null;

  @override
  void initState() {
    super.initState();
    if (isEditing) {
      _nameController.text = widget.editModule!.name;
      _selectedIcon = widget.editModule!.icon;
      _selectedColor = widget.editModule!.color;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(isEditing ? 'Sửa module' : 'Thêm module'),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Preview
              _buildPreview(),
              const SizedBox(height: 24),

              // Name
              TextFormField(
                controller: _nameController,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Tên module',
                  hintText: 'Ví dụ: Đầu tư, Bảo hiểm...',
                  prefixIcon: Icon(Icons.widgets_outlined),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Vui lòng nhập tên module';
                  }
                  return null;
                },
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 24),

              // Icon picker
              Text(
                'Biểu tượng',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 8),
              _buildIconPicker(),
              const SizedBox(height: 24),

              // Color picker
              Text(
                'Màu sắc',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 8),
              _buildColorPicker(),
              const SizedBox(height: 32),

              // Save button
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton.icon(
                  onPressed: _isLoading ? null : _save,
                  icon: _isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.check),
                  label: Text(isEditing ? 'Cập nhật' : 'Lưu'),
                ),
              ),

              if (!isEditing) ...[
                const SizedBox(height: 16),
                Center(
                  child: Text(
                    'Sau khi tạo, bạn có thể thêm trường dữ liệu tùy chỉnh',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.outline,
                        ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPreview() {
    final color = ColorHelper.getColor(_selectedColor);
    return Center(
      child: Column(
        children: [
          CircleAvatar(
            radius: 32,
            backgroundColor: color.withValues(alpha: 0.15),
            child: Icon(
              IconHelper.getIcon(_selectedIcon),
              color: color,
              size: 32,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _nameController.text.isEmpty ? 'Module' : _nameController.text,
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ],
      ),
    );
  }

  Widget _buildIconPicker() {
    final icons = IconHelper.allIconNames;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: icons.map((iconName) {
        final isSelected = _selectedIcon == iconName;
        return InkWell(
          onTap: () => setState(() => _selectedIcon = iconName),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: isSelected
                  ? Theme.of(context).colorScheme.primaryContainer
                  : Theme.of(context).colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(12),
              border: isSelected
                  ? Border.all(
                      color: Theme.of(context).colorScheme.primary,
                      width: 2,
                    )
                  : null,
            ),
            child: Icon(
              IconHelper.getIcon(iconName),
              size: 20,
              color: isSelected
                  ? Theme.of(context).colorScheme.primary
                  : Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildColorPicker() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: ColorHelper.availableColors.map((color) {
        final hex = ColorHelper.toHex(color);
        final isSelected = _selectedColor == hex;
        return InkWell(
          onTap: () => setState(() => _selectedColor = hex),
          borderRadius: BorderRadius.circular(20),
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              border: isSelected
                  ? Border.all(
                      color: Theme.of(context).colorScheme.onSurface,
                      width: 3,
                    )
                  : null,
            ),
            child: isSelected
                ? const Icon(Icons.check, color: Colors.white, size: 20)
                : null,
          ),
        );
      }).toList(),
    );
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final provider = context.read<ModuleProvider>();

      final module = AppModule(
        id: isEditing ? widget.editModule!.id : _uuid.v4(),
        name: _nameController.text.trim(),
        icon: _selectedIcon,
        color: _selectedColor,
        isDefault: isEditing ? widget.editModule!.isDefault : false,
      );

      if (isEditing) {
        await provider.updateModule(module);
      } else {
        await provider.addModule(module);
      }

      if (mounted) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isEditing ? 'Đã cập nhật module' : 'Đã thêm module'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Lỗi: ${e.toString()}'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }
}
