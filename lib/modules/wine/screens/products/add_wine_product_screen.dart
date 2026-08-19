import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../models/wine_product.dart';
import '../../models/wine_variant.dart';
import '../../providers/wine_product_provider.dart';

class AddWineProductScreen extends StatefulWidget {
  final WineProduct? editProduct;
  const AddWineProductScreen({super.key, this.editProduct});

  @override
  State<AddWineProductScreen> createState() => _AddWineProductScreenState();
}

class _AddWineProductScreenState extends State<AddWineProductScreen> {
  static const _purple = Color(0xFF6C2BD9);
  static const _navy = Color(0xFF101B4D);
  static const _border = Color(0xFFE5E7EB);

  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _skuController = TextEditingController();
  final _shortNameController = TextEditingController();
  final _volumeMlController = TextEditingController();
  final _noteController = TextEditingController();
  final _uuid = const Uuid();

  String? _selectedWineType;
  String? _selectedBottleType;
  List<String> _selectedVariantOptionIds = [];
  bool _isLoading = false;

  static const _wineTypes = ['gao', 'gao loai 2', 'nep', 'dauxanh', 'vangnep', 'dtht', 'Khác'];
  static const _wineTypeLabels = {'gao': 'Gạo', 'gao loai 2': 'Gạo loại 2', 'nep': 'Nếp', 'dauxanh': 'Đậu xanh', 'vangnep': 'Vang nếp', 'dtht': 'ĐTHT', 'Khác': 'Khác'};
  static const _bottleTypes = ['pet', 'su', 'thuytinh', 'Khác'];
  static const _bottleTypeLabels = {'pet': 'PET', 'su': 'Sứ', 'thuytinh': 'Thủy tinh', 'Khác': 'Khác'};

  bool get isEditing => widget.editProduct != null;

  @override
  void initState() {
    super.initState();
    if (isEditing) {
      final p = widget.editProduct!;
      _nameController.text = p.name;
      _skuController.text = p.sku;
      _shortNameController.text = p.shortName ?? '';
      _volumeMlController.text = p.volumeMl?.toString() ?? '';
      _selectedWineType = p.wineType;
      _selectedBottleType = p.bottleType;
      _noteController.text = p.note ?? '';
      if (p.variants != null) {
        _selectedVariantOptionIds = p.variants!.map((v) => v.variantOptionId).toList();
      }
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<WineProductProvider>().loadVariantTypes();
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    _skuController.dispose();
    _shortNameController.dispose();
    _volumeMlController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.white,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: _navy), onPressed: () => Navigator.pop(context)),
        title: Text(isEditing ? 'Sửa sản phẩm' : 'Thêm sản phẩm', style: const TextStyle(color: _navy, fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: Consumer<WineProductProvider>(
        builder: (context, provider, _) {
          return Form(
            key: _formKey,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 1. Tên đầy đủ (name)
                  _buildField(
                    controller: _nameController,
                    label: 'Tên đầy đủ *',
                    hint: 'Ví dụ: Bàu Đá 650ml Bình Định',
                    icon: Icons.liquor,
                    validator: (v) => v == null || v.trim().isEmpty ? 'Bắt buộc' : null,
                  ),
                  const SizedBox(height: 14),

                  // 2. Mã SKU (sku)
                  _buildField(
                    controller: _skuController,
                    label: 'Mã SKU *',
                    hint: 'Ví dụ: BD650',
                    icon: Icons.qr_code,
                    validator: (v) => v == null || v.trim().isEmpty ? 'Bắt buộc' : null,
                  ),
                  const SizedBox(height: 14),

                  // 3. Tên ngắn (short_name)
                  _buildField(
                    controller: _shortNameController,
                    label: 'Tên ngắn',
                    hint: 'Ví dụ: Bàu Đá',
                    icon: Icons.short_text,
                  ),
                  const SizedBox(height: 14),

                  // 4. Dung tích (volume_ml)
                  _buildField(
                    controller: _volumeMlController,
                    label: 'Dung tích (ml)',
                    hint: 'Ví dụ: 650',
                    icon: Icons.local_drink_outlined,
                    keyboardType: TextInputType.number,
                    formatters: [FilteringTextInputFormatter.digitsOnly],
                  ),
                  const SizedBox(height: 14),

                  // 5. Loại rượu (wine_type) - dropdown
                  _buildDropdown(
                    label: 'Loại rượu',
                    icon: Icons.wine_bar_outlined,
                    value: _selectedWineType,
                    items: _wineTypes,
                    labels: _wineTypeLabels,
                    onChanged: (v) => setState(() => _selectedWineType = v),
                  ),
                  const SizedBox(height: 14),

                  // 6. Loại chai (bottle_type) - dropdown
                  _buildDropdown(
                    label: 'Loại chai',
                    icon: Icons.emoji_food_beverage_outlined,
                    value: _selectedBottleType,
                    items: _bottleTypes,
                    labels: _bottleTypeLabels,
                    onChanged: (v) => setState(() => _selectedBottleType = v),
                  ),
                  const SizedBox(height: 14),

                  // 7. Ghi chú (note)
                  _buildField(
                    controller: _noteController,
                    label: 'Ghi chú',
                    hint: 'Ghi chú thêm...',
                    icon: Icons.notes_outlined,
                    maxLines: 3,
                  ),
                  const SizedBox(height: 20),

                  // Variant options selector
                  _buildVariantSection(provider),
                  const SizedBox(height: 24),

                  // Save button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: FilledButton.icon(
                      onPressed: _isLoading ? null : _save,
                      icon: _isLoading
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.check),
                      label: Text(isEditing ? 'Cập nhật' : 'Lưu sản phẩm'),
                      style: FilledButton.styleFrom(backgroundColor: _purple),
                    ),
                  ),

                  // Delete button for editing
                  if (isEditing) ...[
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _delete,
                        icon: const Icon(Icons.delete_outline, color: Colors.red, size: 18),
                        label: const Text('Xóa sản phẩm', style: TextStyle(color: Colors.red)),
                        style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.red), padding: const EdgeInsets.symmetric(vertical: 14)),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildField({
    required TextEditingController controller,
    required String label,
    String? hint,
    IconData? icon,
    TextInputType? keyboardType,
    List<TextInputFormatter>? formatters,
    String? Function(String?)? validator,
    int maxLines = 1,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      inputFormatters: formatters,
      maxLines: maxLines,
      validator: validator,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        hintStyle: TextStyle(fontSize: 14, color: Colors.grey[400]),
        prefixIcon: icon != null ? Icon(icon, size: 20, color: Colors.grey[500]) : null,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _border)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _border)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _purple)),
      ),
    );
  }

  Widget _buildDropdown({
    required String label,
    required IconData icon,
    required String? value,
    required List<String> items,
    required ValueChanged<String?> onChanged,
    Map<String, String>? labels,
  }) {
    // If value not in items, add it to avoid crash
    final safeItems = [...items];
    if (value != null && !safeItems.contains(value)) {
      safeItems.insert(0, value);
    }
    return InputDecorator(
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, size: 20, color: Colors.grey[500]),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _border)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _border)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _purple)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          isExpanded: true,
          hint: Text('Chọn $label', style: TextStyle(fontSize: 14, color: Colors.grey[400])),
          dropdownColor: Colors.white,
          items: safeItems.map((item) => DropdownMenuItem(value: item, child: Text(labels?[item] ?? item, style: const TextStyle(fontSize: 14)))).toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }

  Widget _buildVariantSection(WineProductProvider provider) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text('Biến thể (Màu sắc)', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _navy)),
            const Spacer(),
            TextButton.icon(
              onPressed: () => _showAddVariantOptionDialog(provider),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Thêm màu'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: provider.allVariantOptions.map((option) {
            final isSelected = _selectedVariantOptionIds.contains(option.id);
            return FilterChip(
              label: Text(option.name),
              selected: isSelected,
              selectedColor: _purple.withOpacity(0.15),
              checkmarkColor: _purple,
              onSelected: (selected) {
                setState(() {
                  if (selected) {
                    _selectedVariantOptionIds.add(option.id);
                  } else {
                    _selectedVariantOptionIds.remove(option.id);
                  }
                });
              },
            );
          }).toList(),
        ),
      ],
    );
  }

  void _showAddVariantOptionDialog(WineProductProvider provider) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Thêm màu mới'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(hintText: 'Ví dụ: Vàng, Nâu...'),
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          FilledButton(
            onPressed: () async {
              if (controller.text.trim().isEmpty) return;
              final types = provider.variantTypes;
              if (types.isEmpty) return;
              await provider.addVariantOption(WineVariantOption(
                id: '',
                variantTypeId: types.first.id,
                name: controller.text.trim(),
              ));
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('Thêm'),
          ),
        ],
      ),
    );
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);

    try {
      final provider = context.read<WineProductProvider>();
      final productId = isEditing ? widget.editProduct!.id : _uuid.v4();

      final product = WineProduct(
        id: productId,
        sku: _skuController.text.trim(),
        name: _nameController.text.trim(),
        shortName: _shortNameController.text.trim().isEmpty ? null : _shortNameController.text.trim(),
        volumeMl: int.tryParse(_volumeMlController.text.trim()),
        wineType: _selectedWineType,
        bottleType: _selectedBottleType,
        note: _noteController.text.trim().isEmpty ? null : _noteController.text.trim(),
      );

      if (isEditing) {
        await provider.updateProduct(product);
      } else {
        await provider.addProduct(product);
      }

      // Save variants
      for (final optionId in _selectedVariantOptionIds) {
        if (isEditing && widget.editProduct!.variants != null) {
          final exists = widget.editProduct!.variants!.any((v) => v.variantOptionId == optionId);
          if (exists) continue;
        }
        await provider.addVariant(WineProductVariant(
          id: '',
          productId: productId,
          variantOptionId: optionId,
        ));
      }

      if (mounted) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(isEditing ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm'),
          behavior: SnackBarBehavior.floating,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Lỗi: $e'), backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _delete() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa sản phẩm'),
        content: Text('Xóa "${widget.editProduct!.name}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await context.read<WineProductProvider>().deleteProduct(widget.editProduct!.id);
              if (mounted) Navigator.pop(context, true);
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
  }
}
