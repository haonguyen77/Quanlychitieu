import 'dart:io';
import 'package:flutter/material.dart' hide Category;
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import 'package:image_picker/image_picker.dart';
import '../../widgets/image_gallery_viewer.dart';
import 'package:intl/intl.dart';
import '../../models/transaction.dart';
import '../../models/category.dart';
import '../../providers/transaction_provider.dart';
import '../../providers/category_provider.dart';
import '../../providers/account_provider.dart';
import '../../providers/module_provider.dart';
import '../../providers/beneficiary_provider.dart';
import '../../repositories/transaction_repository.dart';
import '../../services/usage_frequency_service.dart';
import '../../utils/formatters.dart';
import '../../utils/color_helper.dart';
import '../../utils/icon_helper.dart';
import '../../app/constants.dart';

class AddTransactionScreen extends StatefulWidget {
  final Transaction? editTransaction;
  final String? preSelectedModuleId;
  final String? preSelectedAccountId;

  const AddTransactionScreen({
    super.key,
    this.editTransaction,
    this.preSelectedModuleId,
    this.preSelectedAccountId,
  });

  @override
  State<AddTransactionScreen> createState() => _AddTransactionScreenState();
}

class _AddTransactionScreenState extends State<AddTransactionScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _titleFocusNode = FocusNode();
  final _amountController = TextEditingController();
  final _amountFocusNode = FocusNode();
  final _noteController = TextEditingController();
  final _eventController = TextEditingController();
  final _beneficiaryController = TextEditingController();
  final _storeController = TextEditingController();
  final _warrantyMonthsController = TextEditingController();
  final _uuid = const Uuid();

  int _type = AppConstants.typeExpense;
  DateTime _selectedDate = DateTime.now();
  String? _selectedCategoryId;
  String? _selectedAccountId;
  String? _selectedModuleId;
  int _quantity = 1;
  DateTime? _warrantyDate;
  bool _isLoading = false;
  bool _showExpanded = false;
  List<String> _capturedImages = [];

  // Title suggestions
  List<Map<String, dynamic>> _titleSuggestions = [];
  bool _showTitleSuggestions = false;

  bool get isEditing => widget.editTransaction != null;

  static const _navyBlue = Color(0xFF004DEB);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });

    if (isEditing) {
      final t = widget.editTransaction!;
      _titleController.text = t.title;
      _amountController.text = t.amount.toStringAsFixed(0);
      _noteController.text = t.note ?? '';
      _eventController.text = t.event ?? '';
      _beneficiaryController.text = t.beneficiary ?? '';
      _storeController.text = t.store ?? '';
      _warrantyMonthsController.text = t.warrantyMonths?.toString() ?? '';
      _type = t.type;
      _selectedDate = t.date;
      _selectedCategoryId = t.categoryId;
      _selectedAccountId = t.accountId;
      _selectedModuleId = t.moduleId;
      _quantity = t.quantity;
      _warrantyDate = t.warrantyDate;
      if (t.event != null || t.beneficiary != null || t.store != null || t.warrantyMonths != null) {
        _showExpanded = true;
      }
    } else {
      _selectedAccountId = widget.preSelectedAccountId;
      _selectedCategoryId = null;
      // Default amount is 0 so the user doesn't have to type it first.
      _amountController.text = '0';
    }

    // When the amount field gains focus and its value is the default "0",
    // select all text so typing overwrites it (no need to delete the 0).
    _amountFocusNode.addListener(() {
      if (_amountFocusNode.hasFocus) {
        final raw = _amountController.text.replaceAll('.', '').replaceAll(',', '');
        if (raw == '0') {
          _amountController.selection = TextSelection(
            baseOffset: 0,
            extentOffset: _amountController.text.length,
          );
        }
      }
    });
  }

  Future<void> _loadData() async {
    final catProvider = context.read<CategoryProvider>();
    final accProvider = context.read<AccountProvider>();
    final modProvider = context.read<ModuleProvider>();
    final benProvider = context.read<BeneficiaryProvider>();

    await Future.wait([
      catProvider.loadCategories(),
      accProvider.loadAccounts(),
      modProvider.loadModules(),
      benProvider.loadBeneficiaries(),
    ]);

    if (!isEditing) {
      // Pre-fill account: ưu tiên theo thứ tự: preSelected → lần dùng gần nhất → đầu tiên trong danh sách
      if (widget.preSelectedAccountId != null) {
        _selectedAccountId = widget.preSelectedAccountId;
      } else {
        final accounts = accProvider.accounts.where((a) => a.isActive).toList();
        if (accounts.isNotEmpty) {
          final sorted = await UsageFrequencyService.instance.sortByAccountFrequency(accounts, (a) => a.id);
          _selectedAccountId = sorted.first.id;
        }
      }

      // Pre-fill category: lần dùng gần nhất → đầu tiên trong danh sách
      final categories = catProvider.allCategories.where((c) => c.isActive).toList();
      if (categories.isNotEmpty) {
        final sorted = await UsageFrequencyService.instance.sortByCategoryFrequency(categories, (c) => c.id);
        _selectedCategoryId = sorted.first.id;
      }

      setState(() {});
    }

    if (!isEditing && modProvider.modules.isNotEmpty) {
      setState(() {
        _selectedModuleId = widget.preSelectedModuleId ?? 'mod_chitieu';
      });
    }

    // Auto-focus vào ô Tên giao dịch sau khi dữ liệu đã sẵn sàng
    if (!isEditing && mounted) {
      FocusScope.of(context).requestFocus(_titleFocusNode);
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _titleFocusNode.dispose();
    _amountController.dispose();
    _amountFocusNode.dispose();
    _noteController.dispose();
    _eventController.dispose();
    _beneficiaryController.dispose();
    _storeController.dispose();
    _warrantyMonthsController.dispose();
    super.dispose();
  }

  // ─── Save Logic ─────────────────────────────────────────────────────────

  Future<void> _saveTransaction() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    final amountText = _amountController.text.replaceAll('.', '').replaceAll(',', '');
    final amount = double.tryParse(amountText) ?? 0;

    final warrantyMonths = int.tryParse(_warrantyMonthsController.text);

    // Auto-calculate warranty date if warranty months provided and no manual date
    DateTime? finalWarrantyDate = _warrantyDate;
    if (warrantyMonths != null && warrantyMonths > 0 && finalWarrantyDate == null) {
      finalWarrantyDate = DateTime(
        _selectedDate.year,
        _selectedDate.month + warrantyMonths,
        _selectedDate.day,
      );
    }

    final transaction = Transaction(
      id: isEditing ? widget.editTransaction!.id : _uuid.v4(),
      type: _type,
      amount: amount,
      title: _titleController.text.trim(),
      note: _noteController.text.trim().isEmpty ? null : _noteController.text.trim(),
      categoryId: _selectedCategoryId,
      accountId: _selectedAccountId,
      moduleId: _selectedModuleId,
      date: _selectedDate,
      images: _capturedImages.isNotEmpty ? _capturedImages.join(',') : null,
      quantity: _quantity,
      beneficiary: _beneficiaryController.text.trim().isEmpty ? null : _beneficiaryController.text.trim(),
      event: _eventController.text.trim().isEmpty ? null : _eventController.text.trim(),
      store: _storeController.text.trim().isEmpty ? null : _storeController.text.trim(),
      warrantyMonths: warrantyMonths,
      warrantyDate: finalWarrantyDate,
    );

    final provider = context.read<TransactionProvider>();
    if (isEditing) {
      await provider.updateTransaction(transaction);
    } else {
      await provider.addTransaction(transaction);
    }

    // Record usage frequency for smart defaults
    UsageFrequencyService.instance.recordTransactionUsage(
      accountId: _selectedAccountId,
      categoryId: _selectedCategoryId,
      moduleId: _selectedModuleId,
    );

    setState(() => _isLoading = false);

    if (mounted) Navigator.pop(context, true);
  }

  // ─── Title Suggestions ──────────────────────────────────────────────────

  Future<void> _onTitleChanged(String value) async {
    // Auto-capitalize first letter
    if (value.isNotEmpty && value[0] != value[0].toUpperCase()) {
      final capitalized = value[0].toUpperCase() + value.substring(1);
      _titleController.value = TextEditingValue(
        text: capitalized,
        selection: TextSelection.collapsed(offset: capitalized.length),
      );
      value = capitalized;
    }

    if (value.isEmpty) {
      setState(() {
        _titleSuggestions = [];
        _showTitleSuggestions = false;
      });
      return;
    }
    final suggestions = await context.read<TransactionProvider>().getTitleSuggestions(value);
    setState(() {
      _titleSuggestions = suggestions;
      _showTitleSuggestions = suggestions.isNotEmpty;
    });
  }

  void _selectTitleSuggestion(Map<String, dynamic> suggestion) {
    _titleController.text = suggestion['title'] as String;
    if (suggestion['category_id'] != null) {
      setState(() {
        _selectedCategoryId = suggestion['category_id'] as String;
      });
    }
    setState(() => _showTitleSuggestions = false);
  }

  // ─── Date Navigation ────────────────────────────────────────────────────

  void _previousDay() {
    setState(() {
      _selectedDate = _selectedDate.subtract(const Duration(days: 1));
    });
  }

  void _nextDay() {
    setState(() {
      _selectedDate = _selectedDate.add(const Duration(days: 1));
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2099),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  // ─── Image Capture ──────────────────────────────────────────────────────

  Future<void> _captureImage() async {
    final picker = ImagePicker();
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (context) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Chụp ảnh'),
              onTap: () => Navigator.pop(context, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Chọn nhiều ảnh'),
              onTap: () => Navigator.pop(context, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );

    if (source == null) return;

    if (source == ImageSource.camera) {
      final image = await picker.pickImage(source: source, maxWidth: 1200, imageQuality: 85);
      if (image != null) {
        setState(() {
          _capturedImages.add(image.path);
        });
      }
    } else {
      // Multi-select from gallery
      final images = await picker.pickMultiImage(maxWidth: 1200, imageQuality: 85);
      if (images.isNotEmpty) {
        setState(() {
          _capturedImages.addAll(images.map((img) => img.path));
        });
      }
    }
  }

  // ─── Warranty Date Picker ───────────────────────────────────────────────

  Future<void> _pickWarrantyDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _warrantyDate ?? DateTime.now().add(const Duration(days: 365)),
      firstDate: DateTime.now(),
      lastDate: DateTime(2099),
    );
    if (picked != null) {
      setState(() => _warrantyDate = picked);
    }
  }

  // ─── Build ──────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          isEditing ? 'Sửa chi tiêu' : 'Thêm chi tiêu',
          style: const TextStyle(
            color: Colors.black87,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: false,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: ElevatedButton.icon(
              onPressed: _isLoading ? null : _saveTransaction,
              icon: const Icon(Icons.save_outlined, size: 18),
              label: const Text('Lưu'),
              style: ElevatedButton.styleFrom(
                backgroundColor: _navyBlue,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              ),
            ),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 8),
              _buildDateAndTypeRow(),
              const SizedBox(height: 12),
              _buildPaymentMethodSection(),
              const SizedBox(height: 20),
              _buildTitleField(),
              if (_showTitleSuggestions) _buildTitleSuggestions(),
              const SizedBox(height: 16),
              _buildAmountAndQuantityRow(),
              _buildAmountSuggestions(),
              const SizedBox(height: 20),
              _buildCategorySection(),
              const SizedBox(height: 20),
              _buildModuleSection(),
              const SizedBox(height: 20),
              _buildBeneficiaryField(),
              const SizedBox(height: 20),
              _buildAttachmentSection(),
              const SizedBox(height: 16),
              _buildNoteField(),
              const SizedBox(height: 16),
              _buildExpandToggle(),
              if (_showExpanded) ...[
                const SizedBox(height: 16),
                _buildExpandedSection(),
              ],
              const SizedBox(height: 24),
              _buildSaveButton(),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Date + Type Row ────────────────────────────────────────────────────

  Widget _buildDateAndTypeRow() {
    final dateText = DateFormat('dd/MM/yyyy').format(_selectedDate);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.pink[50]?.withOpacity(0.3),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          // Date section
          GestureDetector(
            onTap: _previousDay,
            child: Icon(Icons.chevron_left, size: 22, color: Colors.grey[700]),
          ),
          GestureDetector(
            onTap: _pickDate,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]),
                const SizedBox(width: 4),
                Text(dateText, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
              ],
            ),
          ),
          GestureDetector(
            onTap: _nextDay,
            child: Icon(Icons.chevron_right, size: 22, color: Colors.grey[700]),
          ),
          const Spacer(),
          // Type toggle - icon only
          _buildTypeIconButton(Icons.arrow_downward, 0, Colors.red),
          const SizedBox(width: 8),
          _buildTypeIconButton(Icons.arrow_upward, 1, Colors.green),
        ],
      ),
    );
  }

  Widget _buildTypeIconButton(IconData icon, int type, Color color) {
    final isSelected = _type == type;
    final label = type == 0 ? 'Chi' : 'Thu';
    return GestureDetector(
      onTap: () => setState(() {
        _type = type;
        _selectedCategoryId = null;
      }),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? color.withOpacity(0.15) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? color : Colors.grey[300]!,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: isSelected ? color : Colors.grey[400]),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.normal,
                color: isSelected ? color : Colors.grey[500],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Title Field ────────────────────────────────────────────────────────

  Widget _buildTitleField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Tên giao dịch *', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.grey[800])),
        const SizedBox(height: 6),
        TextFormField(
          controller: _titleController,
          focusNode: _titleFocusNode,
          onChanged: _onTitleChanged,
          maxLength: 100,
          decoration: InputDecoration(
            hintText: 'Nhập tên giao dịch',
            counterText: '',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey[300]!)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey[300]!)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            filled: false,
          ),
          validator: (value) {
            if (value == null || value.trim().isEmpty) return 'Vui lòng nhập tên giao dịch';
            return null;
          },
        ),
      ],
    );
  }

  Widget _buildTitleSuggestions() {
    return Container(
      constraints: const BoxConstraints(maxHeight: 150),
      margin: const EdgeInsets.only(top: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey[200]!),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4)],
      ),
      child: ListView.builder(
        shrinkWrap: true,
        itemCount: _titleSuggestions.length,
        itemBuilder: (context, index) {
          final s = _titleSuggestions[index];
          return ListTile(
            dense: true,
            title: Text(s['title'] as String, style: const TextStyle(fontSize: 13)),
            trailing: Text('${s['cnt']}x', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
            onTap: () => _selectTitleSuggestion(s),
          );
        },
      ),
    );
  }

  // ─── Amount + Quantity ──────────────────────────────────────────────────

  Widget _buildAmountAndQuantityRow() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Amount
        Expanded(
          flex: 3,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Số tiền *', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.grey[800])),
              const SizedBox(height: 6),
              TextFormField(
                controller: _amountController,
                focusNode: _amountFocusNode,
                keyboardType: TextInputType.number,
                inputFormatters: [_ThousandsSeparatorFormatter()],
                decoration: InputDecoration(
                  hintText: '0',
                  suffixText: 'đ',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey[300]!)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey[300]!)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  filled: false,
                ),
                onChanged: (_) => setState(() {}),
                validator: (value) {
                  if (value == null || value.isEmpty) return 'Nhập số tiền';
                  final amount = double.tryParse(value.replaceAll('.', '').replaceAll(',', ''));
                  if (amount == null) return 'Không hợp lệ';
                  return null;
                },
              ),
            ],
          ),
        ),
        const SizedBox(width: 16),
        // Quantity
        Expanded(
          flex: 2,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Số lượng', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.grey[800])),
              const SizedBox(height: 6),
              Row(
                children: [
                  _buildQuantityButton(Icons.remove, () {
                    if (_quantity > 1) setState(() => _quantity--);
                  }),
                  Expanded(
                    child: Container(
                      height: 48,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        border: Border.symmetric(
                          horizontal: BorderSide(color: Colors.grey[300]!),
                        ),
                      ),
                      child: Text(
                        '$_quantity',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                  _buildQuantityButton(Icons.add, () {
                    setState(() => _quantity++);
                  }),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildQuantityButton(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 48,
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey[300]!),
          borderRadius: icon == Icons.remove
              ? const BorderRadius.horizontal(left: Radius.circular(10))
              : const BorderRadius.horizontal(right: Radius.circular(10)),
        ),
        child: Icon(icon, size: 18, color: Colors.grey[700]),
      ),
    );
  }

  Widget _buildAmountSuggestions() {
    final text = _amountController.text.replaceAll('.', '').replaceAll(',', '');
    if (text.isEmpty) return const SizedBox.shrink();

    final base = int.tryParse(text) ?? 0;
    if (base <= 0) return const SizedBox.shrink();

    final suggestions = <int>{};
    for (final multiplier in [1000, 10000, 100000, 1000000]) {
      final value = base * multiplier;
      if (value > base && value >= 1000 && value <= 1000000000) {
        suggestions.add(value);
      }
    }
    if (base >= 1000) {
      for (final multiplier in [10, 100, 1000]) {
        final value = base * multiplier;
        if (value > base && value >= 1000 && value <= 1000000000) {
          suggestions.add(value);
        }
      }
    }
    suggestions.remove(base);
    suggestions.removeWhere((s) => s <= base || s < 1000 || s > 1000000000);
    final sorted = suggestions.toList()..sort();
    if (sorted.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Wrap(
        spacing: 8,
        runSpacing: 6,
        children: sorted.take(4).map((value) {
          return GestureDetector(
            onTap: () {
              _amountController.text = _ThousandsSeparatorFormatter.format(value);
              setState(() {});
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.blue[50],
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.blue[200]!),
              ),
              child: Text(
                Formatters.currency(value.toDouble()),
                style: TextStyle(fontSize: 12, color: Colors.blue[700]),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  // ─── Payment Method Section ─────────────────────────────────────────────

  Widget _buildPaymentMethodSection() {
    return Consumer<AccountProvider>(
      builder: (context, provider, child) {
        final accounts = provider.accounts.where((a) => a.isActive).toList();
        // Sort by usage frequency (most-used first), fallback to sortOrder
        final sorted = UsageFrequencyService.instance.sortByAccountFrequencySync(accounts, (a) => a.id);

        // Show max 3 + "Thêm" button if more than 4
        final visibleAccounts = sorted.length > 4 ? sorted.take(3).toList() : sorted;
        final hasMore = sorted.length > 4;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Phương thức thanh toán *', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.grey[800])),
            const SizedBox(height: 10),
            Row(
              children: [
                ...visibleAccounts.map((account) {
                  final isSelected = _selectedAccountId == account.id;
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: _buildGridChip(
                        label: account.name,
                        icon: _getAccountIcon(account.icon),
                        iconColor: _parseColor(account.color),
                        isSelected: isSelected,
                        onTap: () => setState(() => _selectedAccountId = account.id),
                      ),
                    ),
                  );
                }),
                if (hasMore)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: _buildGridChip(
                        label: 'Thêm',
                        icon: Icons.more_horiz,
                        iconColor: Colors.grey[600]!,
                        isSelected: false,
                        onTap: () => _showAllPaymentMethods(sorted),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        );
      },
    );
  }

  void _showAllPaymentMethods(List accounts) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return SafeArea(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.6),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text('Phương thức thanh toán', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.grey[800])),
                ),
                Flexible(
                  child: ListView(
                    shrinkWrap: true,
                    children: accounts.map<Widget>((account) {
                      final isSelected = _selectedAccountId == account.id;
                      return ListTile(
                        leading: Icon(_getAccountIcon(account.icon), color: _parseColor(account.color)),
                        title: Text(account.name),
                        trailing: isSelected ? const Icon(Icons.check, color: Color(0xFF004DEB)) : null,
                        onTap: () {
                          setState(() => _selectedAccountId = account.id);
                          Navigator.pop(context);
                        },
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 8),
              ],
            ),
          ),
        );
      },
    );
  }

  // ─── Category Section ───────────────────────────────────────────────────

  Widget _buildCategorySection() {
    return Consumer<CategoryProvider>(
      builder: (context, provider, child) {
        final categories = _type == 0 ? provider.expenseCategories : provider.incomeCategories;
        final flatCategories = categories.where((c) => c.isActive).toList();
        // Sort by usage frequency (most-used first), fallback to original order
        final sorted = UsageFrequencyService.instance.sortByCategoryFrequencySync(flatCategories, (c) => c.id);

        // Show max 7 + "Thêm" if more
        final visibleCategories = sorted.length > 8 ? sorted.take(7).toList() : sorted;
        final hasMore = sorted.length > 8;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Danh mục *', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.grey[800])),
            const SizedBox(height: 10),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                ...visibleCategories.map((category) {
                  final isSelected = _selectedCategoryId == category.id;
                  final catColor = _parseColor(category.color);
                  return _buildGridChip(
                    label: category.name,
                    icon: _getCatIcon(category.icon),
                    iconColor: catColor,
                    isSelected: isSelected,
                    onTap: () => setState(() => _selectedCategoryId = category.id),
                  );
                }),
                if (hasMore)
                  _buildGridChip(
                    label: 'Thêm',
                    icon: Icons.more_horiz,
                    iconColor: Colors.grey[600]!,
                    isSelected: false,
                    onTap: () => _showAllCategories(sorted),
                  ),
              ],
            ),
          ],
        );
      },
    );
  }

  void _showAllCategories(List<Category> categories) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      isScrollControlled: true,
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.6,
          maxChildSize: 0.9,
          minChildSize: 0.4,
          expand: false,
          builder: (context, scrollController) {
            return SafeArea(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text('Chọn danh mục', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.grey[800])),
                  ),
                  Expanded(
                    child: ListView.builder(
                      controller: scrollController,
                      itemCount: categories.length,
                      itemBuilder: (context, index) {
                        final cat = categories[index];
                        final isSelected = _selectedCategoryId == cat.id;
                        final catColor = _parseColor(cat.color);
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor: catColor.withOpacity(0.15),
                            child: Icon(_getCatIcon(cat.icon), size: 18, color: catColor),
                          ),
                          title: Text(cat.name),
                          trailing: isSelected ? const Icon(Icons.check, color: Color(0xFF004DEB)) : null,
                          onTap: () {
                            setState(() => _selectedCategoryId = cat.id);
                            Navigator.pop(context);
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // ─── Module Section ─────────────────────────────────────────────────────

  Widget _buildModuleSection() {
    return Consumer<ModuleProvider>(
      builder: (context, provider, child) {
        // Show ALL active modules (including user-created ones like "Tiết Kiệm").
        // Exceptions hidden here: Thẻ tín dụng and Rượu (and its sub-modules)
        // are managed in their own screens, not as plain expense targets.
        const hiddenIds = {
          'mod_creditcard',
          'mod_ruou', 'mod_ruou_products', 'mod_ruou_customers', 'mod_ruou_inventory',
        };
        final modules = provider.modules
            .where((m) => m.isActive && !hiddenIds.contains(m.id))
            .toList();
        // Sort by usage frequency (most-used first)
        final sorted = UsageFrequencyService.instance.sortByModuleFrequencySync(modules, (m) => m.id);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Module *', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.grey[800])),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: sorted.map((module) {
                final isSelected = _selectedModuleId == module.id;
                // Prefer the module's own stored color/icon; fall back to the
                // known-module styling for the built-in ones.
                final moduleColor = ColorHelper.getColor(module.color);
                return GestureDetector(
                  onTap: () => setState(() => _selectedModuleId = module.id),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: isSelected ? moduleColor.withOpacity(0.15) : moduleColor.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isSelected ? moduleColor : moduleColor.withOpacity(0.4),
                        width: isSelected ? 2 : 1,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(IconHelper.getIcon(module.icon), size: 14, color: moduleColor),
                        const SizedBox(width: 4),
                        Text(
                          module.name,
                          style: TextStyle(fontSize: 11, fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500, color: moduleColor),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        );
      },
    );
  }

  // ─── Attachment Section ─────────────────────────────────────────────────

  Widget _buildAttachmentSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Đính kèm', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.grey[800])),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: _captureImage,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 20),
            decoration: BoxDecoration(
              color: Colors.grey[50],
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey[300]!, style: BorderStyle.solid),
            ),
            child: Column(
              children: [
                Icon(Icons.camera_alt_outlined, size: 28, color: Colors.grey[500]),
                const SizedBox(height: 6),
                RichText(
                  text: TextSpan(
                    style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                    children: [
                      const TextSpan(text: 'Chụp ảnh hoặc '),
                      TextSpan(
                        text: 'chọn ảnh',
                        style: TextStyle(color: Colors.blue[700], fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Hỗ trợ: JPG, PNG, PDF (Tối đa 5MB)',
                  style: TextStyle(fontSize: 11, color: Colors.grey[400]),
                ),
              ],
            ),
          ),
        ),
        if (_capturedImages.isNotEmpty) ...[
          const SizedBox(height: 8),
          SizedBox(
            height: 72,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _capturedImages.length,
              itemBuilder: (context, index) {
                final path = _capturedImages[index];
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Stack(
                    children: [
                      GestureDetector(
                        onTap: () {
                          ImageGalleryViewer.show(
                            context,
                            imagePaths: _capturedImages,
                            initialIndex: index,
                            onDelete: (i) => setState(() => _capturedImages.removeAt(i)),
                          );
                        },
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.file(
                            File(path),
                            width: 72,
                            height: 72,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              width: 72,
                              height: 72,
                              color: Colors.grey[200],
                              child: const Icon(Icons.broken_image, size: 24),
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        top: 2,
                        right: 2,
                        child: GestureDetector(
                          onTap: () => setState(() => _capturedImages.removeAt(index)),
                          child: Container(
                            decoration: const BoxDecoration(
                              color: Colors.black54,
                              shape: BoxShape.circle,
                            ),
                            padding: const EdgeInsets.all(2),
                            child: const Icon(Icons.close, size: 14, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ],
    );
  }

  // ─── Note Field ─────────────────────────────────────────────────────────

  Widget _buildNoteField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Ghi chú', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.grey[800])),
        const SizedBox(height: 6),
        TextFormField(
          controller: _noteController,
          minLines: 1,
          maxLines: 5,
          maxLength: 200,
          decoration: InputDecoration(
            hintText: 'Nhập ghi chú (không bắt buộc)',
            counterText: '',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey[300]!)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey[300]!)),
            contentPadding: const EdgeInsets.all(14),
            filled: false,
          ),
        ),
      ],
    );
  }

  // ─── Beneficiary Field (Người nhận) ──────────────────────────────────────

  Widget _buildBeneficiaryField() {
    return Consumer<BeneficiaryProvider>(
      builder: (context, provider, _) {
        // Names configured in Settings (Cấu hình → Người nhận).
        final names = provider.activeBeneficiaries.map((b) => b.name).toList();
        // Keep the current value selectable even if it's not in the configured
        // list (e.g. editing an older transaction).
        final current = _beneficiaryController.text.trim();
        if (current.isNotEmpty && !names.contains(current)) {
          names.insert(0, current);
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Người nhận', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.grey[800])),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              initialValue: current.isNotEmpty && names.contains(current) ? current : null,
              decoration: InputDecoration(
                hintText: 'Chọn người nhận',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey[300]!)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey[300]!)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                filled: false,
              ),
              items: names.map((name) {
                return DropdownMenuItem(value: name, child: Text(name));
              }).toList(),
              onChanged: (value) {
                setState(() {
                  _beneficiaryController.text = value ?? '';
                });
              },
            ),
          ],
        );
      },
    );
  }

  // ─── Expand Toggle ──────────────────────────────────────────────────────

  Widget _buildExpandToggle() {
    return Center(
      child: GestureDetector(
        onTap: () => setState(() => _showExpanded = !_showExpanded),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          decoration: BoxDecoration(
            border: Border(top: BorderSide(color: Colors.grey[200]!, style: BorderStyle.solid)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Mở rộng',
                style: TextStyle(fontSize: 13, color: Colors.blue[700], fontWeight: FontWeight.w500),
              ),
              const SizedBox(width: 4),
              Icon(
                _showExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                size: 18,
                color: Colors.blue[700],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Expanded Section ───────────────────────────────────────────────────

  Widget _buildExpandedSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Sự kiện
        _buildExpandedField(
          label: 'Sự kiện',
          controller: _eventController,
          hint: 'Chọn sự kiện',
          icon: Icons.event,
        ),
        const SizedBox(height: 14),
        // Cửa hàng
        _buildExpandedField(
          label: 'Cửa hàng',
          controller: _storeController,
          hint: 'Nhập tên cửa hàng / nhà cung cấp',
          maxLength: 100,
        ),
        const SizedBox(height: 14),
        // Bảo hành
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('BH (tháng)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.grey[800])),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _warrantyMonthsController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      hintText: 'Số tháng',
                      suffixText: 'tháng',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey[300]!)),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey[300]!)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      filled: false,
                    ),
                    onChanged: (value) {
                      final months = int.tryParse(value);
                      if (months != null && months > 0 && _warrantyDate == null) {
                        setState(() {
                          _warrantyDate = DateTime(
                            _selectedDate.year,
                            _selectedDate.month + months,
                            _selectedDate.day,
                          );
                        });
                      }
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Hết BH', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.grey[800])),
                  const SizedBox(height: 6),
                  GestureDetector(
                    onTap: _pickWarrantyDate,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey[300]!),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.calendar_today, size: 14, color: Colors.grey[500]),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              _warrantyDate != null
                                  ? DateFormat('dd/MM/yyyy').format(_warrantyDate!)
                                  : 'Chọn ngày',
                              style: TextStyle(
                                fontSize: 12,
                                color: _warrantyDate != null ? Colors.black87 : Colors.grey[500],
                              ),
                            ),
                          ),
                          Icon(Icons.arrow_drop_down, size: 18, color: Colors.grey[500]),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildExpandedField({
    required String label,
    required TextEditingController controller,
    required String hint,
    int? maxLength,
    IconData? icon,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.grey[800])),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          maxLength: maxLength,
          decoration: InputDecoration(
            hintText: hint,
            counterText: maxLength != null ? '${controller.text.length}/$maxLength' : null,
            suffixIcon: icon != null ? Icon(icon, size: 18, color: Colors.grey[500]) : null,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey[300]!)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey[300]!)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            filled: false,
          ),
          onChanged: (_) => setState(() {}),
        ),
      ],
    );
  }

  // ─── Save Button ────────────────────────────────────────────────────────

  Widget _buildSaveButton() {
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          height: 50,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _saveTransaction,
            style: ElevatedButton.styleFrom(
              backgroundColor: _navyBlue,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              elevation: 2,
            ),
            child: _isLoading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Text('Lưu', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          ),
        ),
        if (isEditing) ...[
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: OutlinedButton(
              onPressed: _deleteTransaction,
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.red,
                side: const BorderSide(color: Colors.red),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Xóa giao dịch', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ],
    );
  }

  Future<void> _deleteTransaction() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa giao dịch'),
        content: const Text('Bạn có chắc muốn xóa giao dịch này?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Không')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Có'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      final repo = TransactionRepository();
      await repo.softDelete(widget.editTransaction!.id);
      if (mounted) Navigator.pop(context, true);
    }
  }

  // ─── Grid Chip Widget ───────────────────────────────────────────────────

  Widget _buildGridChip({
    required String label,
    required IconData icon,
    required Color iconColor,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 72,
        child: Column(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: isSelected ? iconColor.withOpacity(0.15) : iconColor.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isSelected ? iconColor : iconColor.withOpacity(0.3),
                  width: isSelected ? 2 : 1,
                ),
              ),
              child: Icon(icon, size: 22, color: iconColor),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                color: isSelected ? iconColor : Colors.grey[700],
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  // ─── Icon Helpers ───────────────────────────────────────────────────────

  IconData _getAccountIcon(String iconName) {
    switch (iconName) {
      case 'cash': return Icons.payments;
      case 'card': return Icons.credit_card;
      case 'bank': return Icons.account_balance;
      case 'momo': return Icons.phone_android;
      case 'wallet': return Icons.account_balance_wallet;
      default: return Icons.more_horiz;
    }
  }

  IconData _getCatIcon(String iconName) {
    switch (iconName) {
      case 'food': return Icons.restaurant;
      case 'transport': return Icons.directions_car;
      case 'shopping': return Icons.shopping_bag;
      case 'health': return Icons.favorite;
      case 'entertainment': return Icons.movie;
      case 'bill': return Icons.receipt;
      case 'education': return Icons.school;
      case 'rent': return Icons.home;
      case 'gift': return Icons.card_giftcard;
      case 'salary': return Icons.account_balance_wallet;
      case 'income': return Icons.trending_up;
      case 'coffee': return Icons.coffee;
      case 'other': return Icons.more_horiz;
      default: return Icons.category;
    }
  }

  Color _parseColor(String colorStr) {
    try {
      final hex = colorStr.replaceAll('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    } catch (_) {
      return Colors.blue;
    }
  }
}

// ─── Thousands Separator Input Formatter ──────────────────────────────────

class _ThousandsSeparatorFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    if (newValue.text.isEmpty) return newValue;

    final cleanText = newValue.text.replaceAll('.', '').replaceAll(',', '');
    if (cleanText.isEmpty) return newValue;

    final number = int.tryParse(cleanText);
    if (number == null) return oldValue;

    final formatted = format(number);
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }

  static String format(int number) {
    final formatter = NumberFormat('#,###', 'vi_VN');
    return formatter.format(number);
  }
}
