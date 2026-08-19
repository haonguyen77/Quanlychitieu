import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../models/account.dart';
import '../../providers/account_provider.dart';
import '../../utils/icon_helper.dart';
import '../../utils/color_helper.dart';

class AddAccountScreen extends StatefulWidget {
  final Account? editAccount;

  const AddAccountScreen({super.key, this.editAccount});

  @override
  State<AddAccountScreen> createState() => _AddAccountScreenState();
}

class _AddAccountScreenState extends State<AddAccountScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _balanceController = TextEditingController();
  final _uuid = const Uuid();

  String _selectedIcon = 'wallet';
  String _selectedColor = '#2196F3';
  bool _includeInTotal = true;
  bool _isLoading = false;

  bool get isEditing => widget.editAccount != null;

  @override
  void initState() {
    super.initState();
    if (isEditing) {
      final acc = widget.editAccount!;
      _nameController.text = acc.name;
      _balanceController.text = acc.currentBalance.toStringAsFixed(0);
      _selectedIcon = acc.icon;
      _selectedColor = acc.color;
      _includeInTotal = acc.includeInTotal;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _balanceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(isEditing ? 'Sửa tài khoản' : 'Thêm tài khoản'),
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
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Tên tài khoản',
                  hintText: 'Ví dụ: MB Bank, Tiền mặt...',
                  prefixIcon: Icon(Icons.account_balance_outlined),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Vui lòng nhập tên tài khoản';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Initial balance
              TextFormField(
                controller: _balanceController,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(
                  labelText: 'Số dư ban đầu',
                  hintText: '0',
                  prefixIcon: Icon(Icons.attach_money),
                  suffixText: '₫',
                ),
              ),
              const SizedBox(height: 16),

              // Include in total
              SwitchListTile(
                title: const Text('Tính vào tổng tài sản'),
                subtitle: const Text('Bao gồm số dư trong tổng tài sản'),
                value: _includeInTotal,
                onChanged: (value) {
                  setState(() => _includeInTotal = value);
                },
                contentPadding: EdgeInsets.zero,
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
            _nameController.text.isEmpty ? 'Tài khoản' : _nameController.text,
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ],
      ),
    );
  }

  Widget _buildIconPicker() {
    final accountIcons = [
      'wallet', 'cash', 'bank', 'card', 'momo', 'shopee', 'phone', 'other'
    ];
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: accountIcons.map((iconName) {
        final isSelected = _selectedIcon == iconName;
        return InkWell(
          onTap: () => setState(() => _selectedIcon = iconName),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            width: 48,
            height: 48,
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
              size: 22,
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
      final provider = context.read<AccountProvider>();
      final balance = double.tryParse(_balanceController.text) ?? 0;

      final account = Account(
        id: isEditing ? widget.editAccount!.id : _uuid.v4(),
        name: _nameController.text.trim(),
        icon: _selectedIcon,
        color: _selectedColor,
        initialBalance: isEditing ? widget.editAccount!.initialBalance : balance,
        currentBalance: isEditing ? balance : balance,
        includeInTotal: _includeInTotal,
      );

      if (isEditing) {
        await provider.updateAccount(account);
      } else {
        await provider.addAccount(account);
      }

      if (mounted) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isEditing ? 'Đã cập nhật tài khoản' : 'Đã thêm tài khoản'),
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
