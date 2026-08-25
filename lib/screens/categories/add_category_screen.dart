import 'dart:math';
import 'package:flutter/material.dart' hide Category;
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../models/category.dart';
import '../../providers/category_provider.dart';
import '../../utils/icon_helper.dart';
import '../../utils/color_helper.dart';

class AddCategoryScreen extends StatefulWidget {
  final int type;
  final Category? editCategory;
  final String? parentId;

  const AddCategoryScreen({
    super.key,
    required this.type,
    this.editCategory,
    this.parentId,
  });

  @override
  State<AddCategoryScreen> createState() => _AddCategoryScreenState();
}

class _AddCategoryScreenState extends State<AddCategoryScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _uuid = const Uuid();

  String _selectedIcon = 'other';
  // Random color by default (Shopee-style) for new categories.
  String _selectedColor = ColorHelper.toHex(
    ColorHelper.availableColors[Random().nextInt(ColorHelper.availableColors.length)],
  );
  bool _isLoading = false;

  bool get isEditing => widget.editCategory != null;
  bool get isChild => widget.parentId != null;

  @override
  void initState() {
    super.initState();
    if (isEditing) {
      _nameController.text = widget.editCategory!.name;
      _selectedIcon = widget.editCategory!.icon;
      _selectedColor = widget.editCategory!.color;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    String title;
    if (isEditing) {
      title = 'Sửa danh mục';
    } else if (isChild) {
      title = 'Thêm danh mục con';
    } else {
      title = 'Thêm danh mục';
    }

    return Scaffold(
      appBar: AppBar(title: Text(title)),
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
                  labelText: 'Tên danh mục',
                  hintText: 'Ví dụ: Ăn uống, Cafe...',
                  prefixIcon: Icon(Icons.label_outline),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Vui lòng nhập tên danh mục';
                  }
                  return null;
                },
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
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPreview() {
    return Center(
      child: Column(
        children: [
          CircleAvatar(
            radius: 32,
            backgroundColor: ColorHelper.getColor(_selectedColor).withValues(alpha: 0.15),
            child: Icon(
              IconHelper.getIcon(_selectedIcon),
              color: ColorHelper.getColor(_selectedColor),
              size: 32,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _nameController.text.isEmpty ? 'Danh mục' : _nameController.text,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (isChild)
            Text(
              '(Danh mục con)',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.outline,
                  ),
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
      final provider = context.read<CategoryProvider>();

      final category = Category(
        id: isEditing ? widget.editCategory!.id : _uuid.v4(),
        name: _nameController.text.trim(),
        icon: _selectedIcon,
        color: _selectedColor,
        parentId: isChild
            ? widget.parentId
            : (isEditing ? widget.editCategory!.parentId : null),
        type: widget.type,
      );

      if (isEditing) {
        await provider.updateCategory(category);
      } else {
        await provider.addCategory(category);
      }

      if (mounted) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isEditing ? 'Đã cập nhật danh mục' : 'Đã thêm danh mục'),
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
