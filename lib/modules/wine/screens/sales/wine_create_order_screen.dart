import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import 'package:image_picker/image_picker.dart';
import '../../models/wine_product.dart';
import '../../models/wine_variant.dart';
import '../../models/wine_customer.dart';
import '../../models/wine_sales_order.dart';
import '../../providers/wine_product_provider.dart';
import '../../providers/wine_customer_provider.dart';
import '../../providers/wine_stock_provider.dart';
import '../../../../utils/formatters.dart';
import '../../../../utils/money_input_formatter.dart';
import '../../../../database/database_helper.dart';

class WineCreateOrderScreen extends StatefulWidget {
  final WineSalesOrder? editOrder;
  const WineCreateOrderScreen({super.key, this.editOrder});

  @override
  State<WineCreateOrderScreen> createState() => _WineCreateOrderScreenState();
}

class _WineCreateOrderScreenState extends State<WineCreateOrderScreen> {
  static const _purple = Color(0xFF6C2BD9);
  static const _navy = Color(0xFF101B4D);
  static const _border = Color(0xFFE5E7EB);

  final _uuid = const Uuid();
  final _customerNameController = TextEditingController();
  final _customerPhoneController = TextEditingController();
  final _addressController = TextEditingController();
  final _wardController = TextEditingController();
  final _cityController = TextEditingController();
  final _shippingFeeController = TextEditingController(text: '0');
  final _note1Controller = TextEditingController();
  final _note2Controller = TextEditingController();

  DateTime _selectedDate = DateTime.now();
  String? _selectedCustomerId;
  final List<_LineItem> _lineItems = [];
  final List<String> _orderImages = [];
  bool _isLoading = false;
  bool _isExpanded = false; // mở rộng sản phẩm

  bool get _isEditing => widget.editOrder != null;

  @override
  void initState() {
    super.initState();
    if (_isEditing) {
      final o = widget.editOrder!;
      _selectedDate = o.date;
      _selectedCustomerId = o.customerId;
      _customerNameController.text = o.customerName ?? '';
      _customerPhoneController.text = o.customerPhone ?? '';
      // Parse address parts
      final addrParts = (o.customerAddress ?? '').split(',');
      _addressController.text = addrParts.isNotEmpty ? addrParts[0].trim() : '';
      _wardController.text = addrParts.length > 1 ? addrParts[1].trim() : '';
      _cityController.text = addrParts.length > 2 ? addrParts.sublist(2).join(',').trim() : '';
      _shippingFeeController.text = o.shippingFee > 0 ? MoneyInputFormatter.format(o.shippingFee) : '0';
      _note1Controller.text = o.note1 ?? '';
      _note2Controller.text = o.note2 ?? '';
      if (o.images != null && o.images!.isNotEmpty) _orderImages.addAll(o.imageList);
      if (o.items != null && o.items!.isNotEmpty) {
        for (final item in o.items!) {
          final li = _LineItem();
          li.quantityController.text = item.quantity.toString();
          li.priceController.text = MoneyInputFormatter.format(item.price);
          li.hasGlass = item.hasGlass == 1;
          li.hasBox = item.hasBox == 1;
          li.selectedVariantId = item.productVariantId;
          li.productName = item.productName;
          li.variantName = item.variantName;
          _lineItems.add(li);
        }
      } else {
        _lineItems.add(_LineItem());
      }
    } else {
      _lineItems.add(_LineItem());
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<WineProductProvider>().loadProducts();
      context.read<WineProductProvider>().loadVariantTypes();
      context.read<WineCustomerProvider>().loadCustomers();
    });
  }

  @override
  void dispose() {
    _customerNameController.dispose();
    _customerPhoneController.dispose();
    _addressController.dispose();
    _wardController.dispose();
    _cityController.dispose();
    _shippingFeeController.dispose();
    _note1Controller.dispose();
    _note2Controller.dispose();
    for (final item in _lineItems) item.dispose();
    super.dispose();
  }

  double get _itemsTotal {
    double total = 0;
    for (final item in _lineItems) {
      final qty = int.tryParse(item.quantityController.text) ?? 0;
      final price = MoneyInputFormatter.parse(item.priceController.text);
      total += qty * price;
    }
    return total;
  }

  double get _shippingFee => MoneyInputFormatter.parse(_shippingFeeController.text);
  double get _grandTotal => _itemsTotal + _shippingFee;

  @override
  Widget build(BuildContext context) {
    final nf = NumberFormat('#,###', 'vi_VN');
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: Row(children: [
                IconButton(icon: const Icon(Icons.close, color: _navy), onPressed: () => Navigator.pop(context)),
                Expanded(child: Text(_isEditing ? 'Sửa đơn hàng' : 'Tạo đơn hàng mới', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _navy), textAlign: TextAlign.center)),
                const SizedBox(width: 48),
              ]),
            ),
            // Form body
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildDatePicker(),
                    const SizedBox(height: 12),
                    _buildCustomerFields(),
                    const SizedBox(height: 16),
                    _buildProductsSection(),
                    const SizedBox(height: 16),
                    if (_isExpanded) _buildExpandedFields(),
                    _buildTotalsSection(nf),
                    const SizedBox(height: 80),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      bottomSheet: _buildBottomButtons(),
    );
  }

  Widget _buildDatePicker() {
    final df = DateFormat('dd/MM/yyyy');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(10)),
      child: Row(children: [
        GestureDetector(
          onTap: () => setState(() => _selectedDate = _selectedDate.subtract(const Duration(days: 1))),
          child: const Icon(Icons.chevron_left, color: _navy),
        ),
        Expanded(
          child: GestureDetector(
            onTap: _pickDate,
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.calendar_today, size: 16, color: Colors.grey[600]),
              const SizedBox(width: 8),
              Text(df.format(_selectedDate), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: _navy)),
            ]),
          ),
        ),
        GestureDetector(
          onTap: () => setState(() => _selectedDate = _selectedDate.add(const Duration(days: 1))),
          child: const Icon(Icons.chevron_right, color: _navy),
        ),
      ]),
    );
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(context: context, initialDate: _selectedDate, firstDate: DateTime(2020), lastDate: DateTime.now().add(const Duration(days: 30)));
    if (picked != null) setState(() => _selectedDate = picked);
  }

  Widget _buildCustomerFields() {
    return Consumer<WineCustomerProvider>(
      builder: (context, customerProvider, _) {
        final customers = customerProvider.customers;
        return Column(children: [
          // Tên khách hàng (with autocomplete)
          _autocompleteField(
            icon: Icons.person_outline,
            hint: 'Tên khách hàng...',
            controller: _customerNameController,
            suggestions: customers.map((c) => c.name).toSet().toList(),
            onSelected: (name) {
              final match = customers.where((c) => c.name == name).firstOrNull;
              if (match != null) {
                setState(() {
                  _selectedCustomerId = match.id;
                  _customerPhoneController.text = match.phone ?? '';
                  _addressController.text = match.address ?? '';
                  _wardController.text = '';
                  _cityController.text = '';
                });
              }
            },
          ),
          const SizedBox(height: 8),
          // Số điện thoại (with autocomplete)
          _autocompleteField(
            icon: Icons.phone_outlined,
            hint: 'Số điện thoại...',
            controller: _customerPhoneController,
            keyboardType: TextInputType.phone,
            suggestions: customers.where((c) => c.phone != null && c.phone!.isNotEmpty).map((c) => c.phone!).toSet().toList(),
            onSelected: (phone) {
              final match = customers.where((c) => c.phone == phone).firstOrNull;
              if (match != null) {
                setState(() {
                  _selectedCustomerId = match.id;
                  _customerNameController.text = match.name;
                  _addressController.text = match.address ?? '';
                  _wardController.text = '';
                  _cityController.text = '';
                });
              }
            },
          ),
          const SizedBox(height: 8),
          // Địa chỉ (with autocomplete)
          _autocompleteField(
            icon: Icons.location_on_outlined,
            hint: 'Nhập địa chỉ...',
            controller: _addressController,
            suggestions: customers.where((c) => c.address != null && c.address!.isNotEmpty).map((c) => c.address!).toSet().toList(),
          ),
          const SizedBox(height: 8),
          // Phường + Thành phố
          Row(children: [
            Expanded(child: _inputField(hint: 'Phường/Xã...', controller: _wardController)),
            const SizedBox(width: 8),
            Expanded(child: _inputField(hint: 'Thành phố...', controller: _cityController)),
          ]),
        ]);
      },
    );
  }

  Widget _autocompleteField({
    IconData? icon,
    required String hint,
    required TextEditingController controller,
    TextInputType? keyboardType,
    List<String> suggestions = const [],
    void Function(String)? onSelected,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return RawAutocomplete<String>(
          textEditingController: controller,
          focusNode: FocusNode(),
          optionsBuilder: (textEditingValue) {
            if (textEditingValue.text.isEmpty) return const Iterable<String>.empty();
            final query = textEditingValue.text.toLowerCase();
            return suggestions.where((s) => s.toLowerCase().contains(query)).take(5);
          },
          onSelected: (value) {
            controller.text = value;
            onSelected?.call(value);
          },
          fieldViewBuilder: (context, textController, focusNode, onFieldSubmitted) {
            return Container(
              height: 48,
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: _border),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(children: [
                if (icon != null) Padding(padding: const EdgeInsets.only(left: 12), child: Icon(icon, size: 18, color: Colors.grey[500])),
                Expanded(
                  child: TextField(
                    controller: textController,
                    focusNode: focusNode,
                    keyboardType: keyboardType,
                    decoration: InputDecoration(
                      hintText: hint, hintStyle: TextStyle(fontSize: 14, color: Colors.grey[400]),
                      border: InputBorder.none, contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      filled: true, fillColor: Colors.white,
                    ),
                  ),
                ),
              ]),
            );
          },
          optionsViewBuilder: (context, onSelected, options) {
            return Align(
              alignment: Alignment.topLeft,
              child: Material(
                elevation: 4,
                borderRadius: BorderRadius.circular(8),
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxHeight: 200, maxWidth: constraints.maxWidth),
                  child: ListView.builder(
                    padding: EdgeInsets.zero,
                    shrinkWrap: true,
                    itemCount: options.length,
                    itemBuilder: (context, index) {
                      final option = options.elementAt(index);
                      return ListTile(
                        dense: true,
                        title: Text(option, style: const TextStyle(fontSize: 13)),
                        onTap: () => onSelected(option),
                      );
                    },
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _inputField({IconData? icon, required String hint, required TextEditingController controller, TextInputType? keyboardType, Widget? suffix}) {
    return Container(
      height: 48,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: _border),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(children: [
        if (icon != null) Padding(padding: const EdgeInsets.only(left: 12), child: Icon(icon, size: 18, color: Colors.grey[500])),
        Expanded(
          child: TextField(
            controller: controller,
            keyboardType: keyboardType,
            decoration: InputDecoration(
              hintText: hint, hintStyle: TextStyle(fontSize: 14, color: Colors.grey[400]),
              border: InputBorder.none, contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              filled: true, fillColor: Colors.white,
            ),
          ),
        ),
        if (suffix != null) Padding(padding: const EdgeInsets.only(right: 8), child: suffix),
      ]),
    );
  }

  Widget _buildProductsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          const Text('Sản phẩm', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: _navy)),
          const Spacer(),
          GestureDetector(
            onTap: () => setState(() => _isExpanded = !_isExpanded),
            child: Icon(_isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down, color: _navy),
          ),
        ]),
        const SizedBox(height: 10),
        for (int i = 0; i < _lineItems.length; i++) _buildLineItemCard(i),
        const SizedBox(height: 8),
        // Add product button
        GestureDetector(
          onTap: () => setState(() => _lineItems.add(_LineItem())),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(10)),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.add_circle_outline, size: 18, color: _purple),
              const SizedBox(width: 8),
              Text('Thêm sản phẩm khác', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: _purple)),
            ]),
          ),
        ),
      ],
    );
  }

  Widget _buildLineItemCard(int index) {
    final item = _lineItems[index];
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(10)),
      child: Column(
        children: [
          // Row 1: Index + Product name + delete
          Row(children: [
            Container(
              width: 26, height: 26,
              decoration: BoxDecoration(color: _purple.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
              child: Center(child: Text('${index + 1}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: _purple))),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: GestureDetector(
                onTap: () => _showProductPicker(index),
                child: Container(
                  height: 40,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(8)),
                  child: Row(children: [
                    Expanded(child: Text(
                      item.productName ?? 'Tìm sản phẩm / SKU...',
                      style: TextStyle(fontSize: 13, color: item.productName != null ? _navy : Colors.grey[400]),
                      maxLines: 1, overflow: TextOverflow.ellipsis,
                    )),
                    const Icon(Icons.chevron_right, size: 18, color: Colors.grey),
                  ]),
                ),
              ),
            ),
            if (_lineItems.length > 1)
              IconButton(icon: const Icon(Icons.delete_outline, size: 20, color: Colors.red), onPressed: () {
                setState(() { _lineItems[index].dispose(); _lineItems.removeAt(index); });
              }, visualDensity: VisualDensity.compact),
          ]),
          const SizedBox(height: 8),
          // Row 2: Quantity + Price
          Row(children: [
            Expanded(child: _smallInput(controller: item.quantityController, hint: 'Nhập số lượng', keyboardType: TextInputType.number, formatters: [FilteringTextInputFormatter.digitsOnly])),
            const SizedBox(width: 8),
            Expanded(child: _moneyInputWithSuggest(controller: item.priceController)),
          ]),
          // Expanded fields per item
          if (_isExpanded) ...[
            const SizedBox(height: 8),
            // Color picker
            Consumer<WineProductProvider>(
              builder: (context, provider, _) {
                final colors = provider.allVariantOptions.where((c) => c.id != 'wvo_none').toList();
                return Container(
                  height: 44,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(8)),
                  child: Row(children: [
                    Icon(Icons.palette_outlined, size: 18, color: Colors.grey[500]),
                    const SizedBox(width: 8),
                    Expanded(
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          isExpanded: true,
                          value: item.selectedColorId,
                          hint: Text('Chọn màu...', style: TextStyle(fontSize: 13, color: Colors.grey[400])),
                          items: [for (final c in colors) DropdownMenuItem(value: c.id, child: Text(c.name, style: const TextStyle(fontSize: 13)))],
                          onChanged: (v) => setState(() => item.selectedColorId = v),
                        ),
                      ),
                    ),
                  ]),
                );
              },
            ),
            const SizedBox(height: 8),
            // Ly / Hộp checkboxes
            Row(children: [
              Expanded(child: Row(children: [
                Checkbox(value: item.hasGlass, onChanged: (v) => setState(() => item.hasGlass = v ?? false), visualDensity: VisualDensity.compact),
                const Text('Ly', style: TextStyle(fontSize: 14)),
              ])),
              Expanded(child: Row(children: [
                Checkbox(value: item.hasBox, onChanged: (v) => setState(() => item.hasBox = v ?? false), visualDensity: VisualDensity.compact),
                const Text('Hộp', style: TextStyle(fontSize: 14)),
              ])),
            ]),
          ],
        ],
      ),
    );
  }

  Widget _smallInput({required TextEditingController controller, required String hint, TextInputType? keyboardType, List<TextInputFormatter>? formatters, String? suffix}) {
    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: _border),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(children: [
        Expanded(
          child: TextField(
            controller: controller,
            keyboardType: keyboardType,
            inputFormatters: formatters,
            decoration: InputDecoration(
              hintText: hint, hintStyle: TextStyle(fontSize: 13, color: Colors.grey[400]),
              border: InputBorder.none, contentPadding: EdgeInsets.zero, isDense: true,
              filled: true, fillColor: Colors.white,
            ),
            style: const TextStyle(fontSize: 14),
            onChanged: (_) => setState(() {}),
          ),
        ),
        if (suffix != null) Text(suffix, style: TextStyle(fontSize: 13, color: Colors.grey[500])),
      ]),
    );
  }

  Widget _moneyInputWithSuggest({required TextEditingController controller}) {
    return _MoneySuggestField(
      controller: controller,
      onChanged: () => setState(() {}),
    );
  }

  Widget _buildExpandedFields() {
    return Column(children: [
      // Notes
      Row(children: [
        Expanded(child: _inputField(icon: Icons.edit_note, hint: 'Ghi chú 1...', controller: _note1Controller)),
        const SizedBox(width: 8),
        Expanded(child: _inputField(icon: Icons.edit_note, hint: 'Ghi chú 2...', controller: _note2Controller)),
      ]),
      const SizedBox(height: 12),
      // Images
      const Align(alignment: Alignment.centerLeft, child: Text('Đính kèm hình ảnh / Chụp ảnh', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500))),
      const SizedBox(height: 8),
      Row(children: [
        Expanded(child: _imageButton(Icons.camera_alt, 'Chụp ảnh', Colors.red[50]!, Colors.red, _captureImage)),
        const SizedBox(width: 8),
        Expanded(child: _imageButton(Icons.photo_library, 'Chọn ảnh', _purple.withOpacity(0.08), _purple, _pickImages)),
      ]),
      const SizedBox(height: 16),
    ]);
  }

  Widget _imageButton(IconData icon, String label, Color bgColor, Color iconColor, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(10)),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, size: 20, color: iconColor),
          const SizedBox(width: 8),
          Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: iconColor)),
        ]),
      ),
    );
  }

  Widget _buildTotalsSection(NumberFormat nf) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: _purple.withOpacity(0.04), borderRadius: BorderRadius.circular(12)),
      child: Column(children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('Tổng tiền:', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
          Text('${nf.format(_itemsTotal.toInt())} đ', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _purple)),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          const Text('Phí ship:', style: TextStyle(fontSize: 14)),
          const Spacer(),
          SizedBox(
            width: 100,
            child: TextField(
              controller: _shippingFeeController,
              keyboardType: TextInputType.number,
              inputFormatters: [MoneyInputFormatter()],
              textAlign: TextAlign.right,
              decoration: InputDecoration(
                isDense: true, contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
                filled: true, fillColor: Colors.white,
              ),
              style: const TextStyle(fontSize: 14),
              onTap: () {
                if (_shippingFeeController.text == '0') {
                  _shippingFeeController.clear();
                }
              },
              onChanged: (_) => setState(() {}),
            ),
          ),
          const SizedBox(width: 4),
          const Text('đ', style: TextStyle(fontSize: 13)),
        ]),
        const SizedBox(height: 10),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('Thanh toán:', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _purple)),
          Text('${nf.format(_grandTotal.toInt())} đ', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _purple)),
        ]),
      ]),
    );
  }

  Widget _buildBottomButtons() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, -2))]),
      child: SafeArea(
        child: Row(children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _clearForm,
              icon: Icon(Icons.delete_outline, size: 18, color: Colors.red[400]),
              label: Text('Xóa', style: TextStyle(color: Colors.red[400])),
              style: OutlinedButton.styleFrom(side: BorderSide(color: Colors.red[300]!), padding: const EdgeInsets.symmetric(vertical: 14)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: FilledButton.icon(
              onPressed: _isLoading ? null : _save,
              icon: _isLoading ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.save, size: 18),
              label: const Text('Lưu đơn'),
              style: FilledButton.styleFrom(backgroundColor: _purple, padding: const EdgeInsets.symmetric(vertical: 14)),
            ),
          ),
        ]),
      ),
    );
  }

  // ─── Actions ────────────────────────────────────────────────────────────

  void _clearForm() {
    setState(() {
      _selectedDate = DateTime.now();
      _customerNameController.clear();
      _customerPhoneController.clear();
      _addressController.clear();
      _wardController.clear();
      _cityController.clear();
      _shippingFeeController.text = '0';
      _note1Controller.clear();
      _note2Controller.clear();
      _orderImages.clear();
      for (final item in _lineItems) item.dispose();
      _lineItems.clear();
      _lineItems.add(_LineItem());
      _selectedCustomerId = null;
    });
  }

  Future<void> _captureImage() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.camera, imageQuality: 80);
    if (image != null) setState(() => _orderImages.add(image.path));
  }

  Future<void> _pickImages() async {
    final picker = ImagePicker();
    final images = await picker.pickMultiImage(imageQuality: 80);
    setState(() { for (final img in images) _orderImages.add(img.path); });
  }

  void _showProductPicker(int lineIndex) {
    final provider = context.read<WineProductProvider>();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        String query = '';
        return StatefulBuilder(builder: (ctx, setSheetState) {
          final filtered = provider.products.where((p) =>
            p.name.toLowerCase().contains(query.toLowerCase()) ||
            p.sku.toLowerCase().contains(query.toLowerCase())
          ).toList();
          return DraggableScrollableSheet(
            initialChildSize: 0.7, minChildSize: 0.4, maxChildSize: 0.9, expand: false,
            builder: (ctx, scroll) => Padding(
              padding: const EdgeInsets.all(16),
              child: Column(children: [
                TextField(
                  autofocus: true,
                  decoration: InputDecoration(hintText: 'Tìm sản phẩm / SKU...', prefixIcon: const Icon(Icons.search), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                  onChanged: (v) => setSheetState(() => query = v),
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: ListView.builder(
                    controller: scroll,
                    itemCount: filtered.length,
                    itemBuilder: (ctx, i) {
                      final p = filtered[i];
                      return ListTile(
                        dense: true,
                        title: Text(p.name),
                        subtitle: Text(p.sku, style: const TextStyle(fontSize: 11)),
                        onTap: () {
                          setState(() {
                            _lineItems[lineIndex].productName = p.name;
                            _lineItems[lineIndex].selectedProductId = p.id;
                          });
                          Navigator.pop(ctx);
                        },
                      );
                    },
                  ),
                ),
              ]),
            ),
          );
        });
      },
    );
  }

  Future<void> _save() async {
    setState(() => _isLoading = true);
    try {
      final provider = context.read<WineStockProvider>();
      final customerProvider = context.read<WineCustomerProvider>();
      final productProvider = context.read<WineProductProvider>();

      // Build full address
      final addressParts = <String>[];
      if (_addressController.text.trim().isNotEmpty) addressParts.add(_addressController.text.trim());
      if (_wardController.text.trim().isNotEmpty) addressParts.add('P. ${_wardController.text.trim()}');
      if (_cityController.text.trim().isNotEmpty) addressParts.add(_cityController.text.trim());
      final fullAddress = addressParts.join(', ');

      // Check/create customer
      final phone = _customerPhoneController.text.trim();
      if (phone.isNotEmpty) {
        final existing = customerProvider.customers.where((c) => c.phone == phone).firstOrNull;
        if (existing == null && _customerNameController.text.trim().isNotEmpty) {
          final newCustomer = await customerProvider.addCustomer(WineCustomer(
            id: _uuid.v4(), name: _customerNameController.text.trim(),
            phone: phone, address: fullAddress,
          ));
          _selectedCustomerId = newCustomer.id;
        } else if (existing != null) {
          _selectedCustomerId = existing.id;
        }
      }

      // Build order items
      final items = <WineSalesOrderItem>[];
      for (final li in _lineItems) {
        if (li.selectedProductId == null && li.productName == null) continue;
        String variantId = li.selectedVariantId ?? '';
        if (variantId.isEmpty && li.selectedProductId != null) {
          // Find or create variant
          await productProvider.selectProduct(li.selectedProductId!);
          final product = productProvider.selectedProduct;
          if (product != null && product.variants != null && product.variants!.isNotEmpty) {
            final colorOption = li.selectedColorId;
            final match = product.variants!.where((v) => colorOption != null ? v.variantOptionId == colorOption : true).firstOrNull;
            variantId = match?.id ?? product.variants!.first.id;
          }
          // If still empty, create a default variant
          if (variantId.isEmpty) {
            final colorId = li.selectedColorId ?? 'wvo_none';
            final newVariant = await productProvider.addVariant(WineProductVariant(
              id: '',
              productId: li.selectedProductId!,
              variantOptionId: colorId,
            ));
            variantId = newVariant.id;
          }
        }
        if (variantId.isEmpty) continue; // Skip if still can't resolve

        items.add(WineSalesOrderItem(
          id: _uuid.v4(),
          salesOrderId: '',
          productVariantId: variantId,
          quantity: int.tryParse(li.quantityController.text) ?? 1,
          price: MoneyInputFormatter.parse(li.priceController.text),
          hasGlass: li.hasGlass ? 1 : 0,
          hasBox: li.hasBox ? 1 : 0,
        ));
      }

      final order = WineSalesOrder(
        id: _isEditing ? widget.editOrder!.id : _uuid.v4(),
        date: _selectedDate,
        customerId: _selectedCustomerId,
        customerName: _customerNameController.text.trim(),
        customerPhone: phone,
        customerAddress: fullAddress,
        shippingFee: _shippingFee,
        totalAmount: _grandTotal,
        note1: _note1Controller.text.trim().isNotEmpty ? _note1Controller.text.trim() : null,
        note2: _note2Controller.text.trim().isNotEmpty ? _note2Controller.text.trim() : null,
        images: _orderImages.isNotEmpty ? _orderImages.join(',') : null,
      );

      if (_isEditing) {
        // Delete old items then re-create
        final db = await DatabaseHelper.instance.database;
        await db.delete('wine_sales_order_items', where: 'sales_order_id = ?', whereArgs: [order.id]);
        await db.update('wine_sales_orders', order.toMap(), where: 'id = ?', whereArgs: [order.id]);
        for (final item in items) {
          await db.insert('wine_sales_order_items', item.copyWith(salesOrderId: order.id).toMap());
        }
      } else {
        await provider.createSalesOrder(order, items);
      }

      if (mounted) {
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Lỗi: $e')));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }
}

// ─── Line Item Model ──────────────────────────────────────────────────────

class _LineItem {
  final quantityController = TextEditingController(text: '1');
  final priceController = TextEditingController();
  String? selectedProductId;
  String? selectedVariantId;
  String? selectedColorId;
  String? productName;
  String? variantName;
  bool hasGlass = false;
  bool hasBox = false;

  void dispose() {
    quantityController.dispose();
    priceController.dispose();
  }
}

// ─── Money Suggest Field ──────────────────────────────────────────────────

class _MoneySuggestField extends StatefulWidget {
  final TextEditingController controller;
  final VoidCallback onChanged;
  const _MoneySuggestField({required this.controller, required this.onChanged});

  @override
  State<_MoneySuggestField> createState() => _MoneySuggestFieldState();
}

class _MoneySuggestFieldState extends State<_MoneySuggestField> {
  static const _border = Color(0xFFE5E7EB);
  static const _purple = Color(0xFF6C2BD9);
  final _focusNode = FocusNode();
  final _overlayController = OverlayPortalController();
  final _layerLink = LayerLink();

  List<String> _suggestions = [];

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onTextChanged);
    _focusNode.addListener(() {
      if (!_focusNode.hasFocus) _overlayController.hide();
    });
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onTextChanged);
    _focusNode.dispose();
    super.dispose();
  }

  void _onTextChanged() {
    final raw = widget.controller.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (raw.isNotEmpty && raw.length <= 3) {
      final num = int.tryParse(raw) ?? 0;
      if (num > 0) {
        final nf = NumberFormat('#,###', 'vi_VN');
        _suggestions = [
          nf.format(num * 10000),
          nf.format(num * 100000),
          nf.format(num * 1000000),
        ];
        _overlayController.show();
        setState(() {});
        return;
      }
    }
    _suggestions = [];
    _overlayController.hide();
    setState(() {});
  }

  void _selectSuggestion(String value) {
    widget.controller.text = value;
    widget.controller.selection = TextSelection.collapsed(offset: value.length);
    _overlayController.hide();
    widget.onChanged();
    setState(() => _suggestions = []);
  }

  @override
  Widget build(BuildContext context) {
    return CompositedTransformTarget(
      link: _layerLink,
      child: OverlayPortal(
        controller: _overlayController,
        overlayChildBuilder: (ctx) {
          return CompositedTransformFollower(
            link: _layerLink,
            targetAnchor: Alignment.bottomLeft,
            followerAnchor: Alignment.topLeft,
            child: Material(
              elevation: 4,
              borderRadius: BorderRadius.circular(8),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 180),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: _suggestions.map((s) => InkWell(
                    onTap: () => _selectSuggestion(s),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      child: Align(alignment: Alignment.centerLeft, child: Text('$s đ', style: const TextStyle(fontSize: 13))),
                    ),
                  )).toList(),
                ),
              ),
            ),
          );
        },
        child: Container(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: _border),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(children: [
            Expanded(
              child: TextField(
                controller: widget.controller,
                focusNode: _focusNode,
                keyboardType: TextInputType.number,
                inputFormatters: [MoneyInputFormatter()],
                decoration: InputDecoration(
                  hintText: '0 đ', hintStyle: TextStyle(fontSize: 13, color: Colors.grey[400]),
                  border: InputBorder.none, contentPadding: EdgeInsets.zero, isDense: true,
                  filled: true, fillColor: Colors.white,
                ),
                style: const TextStyle(fontSize: 14),
                onChanged: (_) => widget.onChanged(),
              ),
            ),
            Text('đ', style: TextStyle(fontSize: 13, color: Colors.grey[500])),
          ]),
        ),
      ),
    );
  }
}
