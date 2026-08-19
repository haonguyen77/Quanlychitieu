import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../models/wine_customer.dart';
import '../../providers/wine_customer_provider.dart';

class AddWineCustomerScreen extends StatefulWidget {
  final WineCustomer? editCustomer;
  const AddWineCustomerScreen({super.key, this.editCustomer});

  @override
  State<AddWineCustomerScreen> createState() => _AddWineCustomerScreenState();
}

class _AddWineCustomerScreenState extends State<AddWineCustomerScreen> {
  static const _purple = Color(0xFF6C2BD9);
  static const _navy = Color(0xFF17213C);
  static const _border = Color(0xFFE5E7EB);

  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();
  final _wardController = TextEditingController();
  final _cityController = TextEditingController();
  final _noteController = TextEditingController();
  final _uuid = const Uuid();
  bool _isLoading = false;

  bool get isEditing => widget.editCustomer != null;

  @override
  void initState() {
    super.initState();
    if (isEditing) {
      final c = widget.editCustomer!;
      _nameController.text = c.name;
      _phoneController.text = c.phone ?? '';
      // Parse address: "123 Street, P. Ward, City"
      final parts = (c.address ?? '').split(',');
      _addressController.text = parts.isNotEmpty ? parts[0].trim() : '';
      _wardController.text = parts.length > 1 ? parts[1].trim().replaceFirst('P. ', '') : '';
      _cityController.text = parts.length > 2 ? parts.sublist(2).join(',').trim() : '';
      _noteController.text = c.note ?? '';
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _wardController.dispose();
    _cityController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white, elevation: 0, surfaceTintColor: Colors.white,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: _navy), onPressed: () => Navigator.pop(context)),
        title: Text(isEditing ? 'Sửa khách hàng' : 'Thêm khách hàng', style: const TextStyle(color: _navy, fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            _field(controller: _nameController, hint: 'Họ tên *', icon: Icons.person_outline, validator: (v) => v == null || v.trim().isEmpty ? 'Bắt buộc' : null),
            const SizedBox(height: 12),
            _field(controller: _phoneController, hint: 'Số điện thoại *', icon: Icons.phone_outlined, keyboardType: TextInputType.phone, validator: (v) => v == null || v.trim().isEmpty ? 'Bắt buộc' : null),
            const SizedBox(height: 12),
            _field(controller: _addressController, hint: 'Địa chỉ', icon: Icons.location_on_outlined),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _field(controller: _wardController, hint: 'Phường/Xã')),
              const SizedBox(width: 8),
              Expanded(child: _field(controller: _cityController, hint: 'Thành phố')),
            ]),
            const SizedBox(height: 12),
            _field(controller: _noteController, hint: 'Ghi chú', icon: Icons.edit_note),
            const SizedBox(height: 32),

            // Buttons
            Row(children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
                  child: const Text('Hủy'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: FilledButton(
                  onPressed: _isLoading ? null : _save,
                  style: FilledButton.styleFrom(backgroundColor: _purple, padding: const EdgeInsets.symmetric(vertical: 14)),
                  child: _isLoading
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text(isEditing ? 'Cập nhật' : 'Lưu'),
                ),
              ),
            ]),

            // Delete button for editing
            if (isEditing) ...[
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _delete,
                  icon: const Icon(Icons.delete_outline, color: Colors.red, size: 18),
                  label: const Text('Xóa khách hàng', style: TextStyle(color: Colors.red)),
                  style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.red), padding: const EdgeInsets.symmetric(vertical: 14)),
                ),
              ),
            ],
          ]),
        ),
      ),
    );
  }

  Widget _field({required TextEditingController controller, required String hint, IconData? icon, TextInputType? keyboardType, String? Function(String?)? validator}) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      validator: validator,
      decoration: InputDecoration(
        hintText: hint, hintStyle: TextStyle(fontSize: 14, color: Colors.grey[400]),
        prefixIcon: icon != null ? Icon(icon, size: 18, color: Colors.grey[500]) : null,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _border)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _border)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _purple)),
      ),
    );
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);

    try {
      final provider = context.read<WineCustomerProvider>();
      // Build full address
      final parts = <String>[];
      if (_addressController.text.trim().isNotEmpty) parts.add(_addressController.text.trim());
      if (_wardController.text.trim().isNotEmpty) parts.add('P. ${_wardController.text.trim()}');
      if (_cityController.text.trim().isNotEmpty) parts.add(_cityController.text.trim());
      final fullAddress = parts.join(', ');

      final customer = WineCustomer(
        id: isEditing ? widget.editCustomer!.id : _uuid.v4(),
        name: _nameController.text.trim(),
        phone: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
        address: fullAddress.isEmpty ? null : fullAddress,
        note: _noteController.text.trim().isEmpty ? null : _noteController.text.trim(),
      );

      if (isEditing) {
        await provider.updateCustomer(customer);
      } else {
        await provider.addCustomer(customer);
      }

      if (mounted) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(isEditing ? 'Đã cập nhật' : 'Đã thêm khách hàng'),
          behavior: SnackBarBehavior.floating,
        ));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Lỗi: $e')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _delete() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa khách hàng'),
        content: Text('Xóa "${widget.editCustomer!.name}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          FilledButton(
            onPressed: () {
              context.read<WineCustomerProvider>().deleteCustomer(widget.editCustomer!.id);
              Navigator.pop(ctx);
              Navigator.pop(context, true);
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
  }
}
