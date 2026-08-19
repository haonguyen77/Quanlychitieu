import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

class WineSalesOrderScreen extends StatefulWidget {
  final WineSalesOrder? editOrder;

  const WineSalesOrderScreen({super.key, this.editOrder});

  @override
  State<WineSalesOrderScreen> createState() => _WineSalesOrderScreenState();
}

class _WineSalesOrderScreenState extends State<WineSalesOrderScreen> {
  final _uuid = const Uuid();
  final _customerNameController = TextEditingController();
  final _customerPhoneController = TextEditingController();
  final _customerAddressController = TextEditingController();
  final _shippingFeeController = TextEditingController(text: '0');
  final _note1Controller = TextEditingController();
  final _note2Controller = TextEditingController();

  DateTime _selectedDate = DateTime.now();
  String? _selectedCustomerId;
  final List<_SalesLineItem> _lineItems = [];
  final List<String> _orderImages = [];
  bool _isLoading = false;

  bool get _isEditing => widget.editOrder != null;

  @override
  void initState() {
    super.initState();
    // Pre-fill data if editing
    if (_isEditing) {
      final order = widget.editOrder!;
      _selectedDate = order.date;
      _selectedCustomerId = order.customerId;
      _customerNameController.text = order.customerName ?? '';
      _customerPhoneController.text = order.customerPhone ?? '';
      _customerAddressController.text = order.customerAddress ?? '';
      _shippingFeeController.text = order.shippingFee > 0
          ? MoneyInputFormatter.format(order.shippingFee)
          : '0';
      _note1Controller.text = order.note1 ?? '';
      _note2Controller.text = order.note2 ?? '';
      if (order.images != null && order.images!.isNotEmpty) {
        _orderImages.addAll(order.imageList);
      }
      // Pre-fill line items from order items
      _lineItems.clear();
      if (order.items != null && order.items!.isNotEmpty) {
        for (final item in order.items!) {
          final lineItem = _SalesLineItem();
          lineItem.selectedProductId = _getProductIdFromVariant(item.productVariantId);
          lineItem.selectedColorOptionId = _getColorFromVariant(item.productVariantId);
          lineItem.quantityController.text = item.quantity.toString();
          lineItem.priceController.text = MoneyInputFormatter.format(item.price);
          lineItem.hasGlass = item.hasGlass == 1;
          lineItem.hasBox = item.hasBox == 1;
          _lineItems.add(lineItem);
        }
      } else {
        _lineItems.add(_SalesLineItem());
      }
    } else {
      // Start with 1 line item by default
      _lineItems.add(_SalesLineItem());
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<WineProductProvider>().loadProducts();
      context.read<WineProductProvider>().loadVariantTypes();
      context.read<WineCustomerProvider>().loadCustomers();
    });
  }

  String? _getProductIdFromVariant(String variantId) {
    // Will be resolved after products load
    // Store variant ID temporarily so product can be resolved
    return null; // resolved in post-frame callback
  }

  String? _getColorFromVariant(String variantId) {
    return null; // resolved in post-frame callback
  }

  @override
  void dispose() {
    _customerNameController.dispose();
    _customerPhoneController.dispose();
    _customerAddressController.dispose();
    _shippingFeeController.dispose();
    _note1Controller.dispose();
    _note2Controller.dispose();
    for (final item in _lineItems) {
      item.dispose();
    }
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

  double get _shippingFee =>
      MoneyInputFormatter.parse(_shippingFeeController.text);

  double get _grandTotal => _itemsTotal + _shippingFee;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditing ? 'Sửa phiếu bán hàng' : 'Phiếu bán hàng'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Date
            _buildDateRow(),
            const SizedBox(height: 16),

            // Customer info
            _buildCustomerSection(),
            const SizedBox(height: 20),

            // Line items
            _buildLineItemsSection(),
            const SizedBox(height: 16),

            // Shipping & totals
            _buildTotalsSection(),
            const SizedBox(height: 16),

            // Notes
            _buildNotesSection(),
            const SizedBox(height: 32),

            // Save button at bottom
            SizedBox(
              width: double.infinity,
              height: 52,
              child: FilledButton.icon(
                onPressed: _isLoading ? null : _save,
                icon: _isLoading
                    ? const SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.check),
                label: Text(_isEditing ? 'Cập nhật phiếu' : 'Lưu phiếu bán hàng'),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildDateRow() {
    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        leading: const Icon(Icons.calendar_today),
        title: const Text('Ngày bán'),
        subtitle: Text(Formatters.relativeDate(_selectedDate)),
        trailing: IconButton(
          icon: const Icon(Icons.date_range),
          onPressed: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: _selectedDate,
              firstDate: DateTime(2020),
              lastDate: DateTime.now().add(const Duration(days: 1)),
            );
            if (picked != null) setState(() => _selectedDate = picked);
          },
        ),
      ),
    );
  }

  Widget _buildCustomerSection() {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.person_outline, size: 20),
                const SizedBox(width: 8),
                Text('Khách hàng',
                    style: Theme.of(context).textTheme.titleSmall),
                const Spacer(),
                Consumer<WineCustomerProvider>(
                  builder: (context, provider, _) {
                    if (provider.customers.isEmpty) return const SizedBox.shrink();
                    return TextButton(
                      onPressed: () => _showCustomerPicker(provider.customers),
                      child: const Text('Chọn KH'),
                    );
                  },
                ),
              ],
            ),
            const SizedBox(height: 8),
            // Customer name with autocomplete suggestions
            Consumer<WineCustomerProvider>(
              builder: (context, customerProvider, _) {
                return Autocomplete<WineCustomer>(
                  optionsBuilder: (TextEditingValue textEditingValue) {
                    if (textEditingValue.text.isEmpty) return const Iterable.empty();
                    final query = textEditingValue.text.toLowerCase();
                    return customerProvider.customers.where((c) =>
                        c.name.toLowerCase().contains(query) ||
                        (c.phone ?? '').contains(query));
                  },
                  displayStringForOption: (c) => c.name,
                  optionsViewBuilder: (context, onSelected, options) {
                    return Align(
                      alignment: Alignment.topLeft,
                      child: Material(
                        elevation: 4,
                        borderRadius: BorderRadius.circular(8),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 150, maxWidth: 300),
                          child: ListView.builder(
                            shrinkWrap: true,
                            itemCount: options.length,
                            itemBuilder: (ctx, i) {
                              final customer = options.elementAt(i);
                              return ListTile(
                                dense: true,
                                title: Text(customer.name),
                                subtitle: Text(customer.phone ?? ''),
                                onTap: () {
                                  onSelected(customer);
                                  // Auto-fill phone and address
                                  _customerPhoneController.text = customer.phone ?? '';
                                  _customerAddressController.text = customer.address ?? '';
                                  _selectedCustomerId = customer.id;
                                },
                              );
                            },
                          ),
                        ),
                      ),
                    );
                  },
                  fieldViewBuilder: (context, controller, focusNode, onSubmitted) {
                    // Sync with our controller
                    controller.addListener(() {
                      _customerNameController.text = controller.text;
                    });
                    if (_customerNameController.text.isNotEmpty && controller.text.isEmpty) {
                      controller.text = _customerNameController.text;
                    }
                    return TextFormField(
                      controller: controller,
                      focusNode: focusNode,
                      decoration: const InputDecoration(
                        labelText: 'Tên khách hàng',
                        isDense: true,
                        prefixIcon: Icon(Icons.person_outline, size: 18),
                      ),
                    );
                  },
                  onSelected: (WineCustomer customer) {
                    _customerNameController.text = customer.name;
                    _customerPhoneController.text = customer.phone ?? '';
                    _customerAddressController.text = customer.address ?? '';
                    _selectedCustomerId = customer.id;
                  },
                );
              },
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _customerPhoneController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Số điện thoại', isDense: true,
              ),
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _customerAddressController,
              decoration: const InputDecoration(
                labelText: 'Địa chỉ', isDense: true,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLineItemsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('Sản phẩm',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600)),
            const Spacer(),
            Text('${_lineItems.length} dòng',
                style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
        const SizedBox(height: 8),
        for (int i = 0; i < _lineItems.length; i++) _buildSalesLineItem(i, _lineItems[i]),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _addLineItem,
            icon: const Icon(Icons.add),
            label: const Text('Thêm sản phẩm'),
          ),
        ),
      ],
    );
  }

  Widget _buildSalesLineItem(int index, _SalesLineItem item) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            // Header row
            Row(
              children: [
                Text('Dòng ${index + 1}',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.w600)),
                if (item.selectedProductId != null)
                  Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: Text(
                      _getProductSku(item.selectedProductId!),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.primary,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                const Spacer(),
                if (_lineItems.length > 1)
                  IconButton(
                    icon: const Icon(Icons.close, size: 18, color: Colors.red),
                    onPressed: () {
                      setState(() {
                        _lineItems[index].dispose();
                        _lineItems.removeAt(index);
                      });
                    },
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
            const SizedBox(height: 4),

            // Product selector - tap to open search dialog
            Consumer<WineProductProvider>(
              builder: (context, provider, _) {
                final selectedProduct = item.selectedProductId != null
                    ? provider.products.where((p) => p.id == item.selectedProductId).firstOrNull
                    : null;

                return InkWell(
                  onTap: () => _showProductPicker(provider.products, index),
                  borderRadius: BorderRadius.circular(12),
                  child: InputDecorator(
                    decoration: InputDecoration(
                      labelText: 'Sản phẩm',
                      isDense: true,
                      prefixIcon: const Icon(Icons.liquor, size: 18),
                      suffixIcon: const Icon(Icons.arrow_drop_down),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Text(
                      selectedProduct != null
                          ? selectedProduct.name
                          : 'Nhấn để chọn sản phẩm',
                      style: TextStyle(
                        color: selectedProduct != null ? null : Theme.of(context).colorScheme.outline,
                      ),
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 8),

            // Variant / Color selector
            Consumer<WineProductProvider>(
              builder: (context, provider, _) {
                final allColors = provider.allVariantOptions.where((c) => c.id != 'wvo_none').toList();

                return Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        value: item.selectedColorOptionId,
                        decoration: const InputDecoration(
                          labelText: 'Màu sắc', isDense: true,
                        ),
                        items: [
                          const DropdownMenuItem<String>(value: null, child: Text('-- Không chọn --')),
                          for (final color in allColors)
                            DropdownMenuItem(value: color.id, child: Text(color.name)),
                        ],
                        onChanged: (value) => setState(() => item.selectedColorOptionId = value),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.add_circle_outline),
                      tooltip: 'Thêm màu mới',
                      onPressed: () => _showAddColorDialog(provider),
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 8),

            // Quantity & Price row
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: item.quantityController,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: const InputDecoration(
                      labelText: 'SL', isDense: true, suffixText: 'chai',
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextFormField(
                    controller: item.priceController,
                    keyboardType: TextInputType.number,
                    inputFormatters: [MoneyInputFormatter()],
                    decoration: const InputDecoration(
                      labelText: 'Giá', isDense: true, suffixText: '₫',
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ],
            ),
            // Price suggestions (dynamic based on input)
            Builder(builder: (_) {
              final priceText = item.priceController.text.replaceAll(',', '');
              final base = int.tryParse(priceText) ?? 0;
              if (base <= 0) {
                // Don't show suggestions when price is empty
                return const SizedBox.shrink();
              }
              // Dynamic suggestions
              final suggestions = <int>{};
              for (final m in [10, 100, 1000]) {
                final v = base * m;
                if (v > base && v >= 1000 && v <= 1000000000) suggestions.add(v);
              }
              suggestions.remove(base);
              final sorted = suggestions.toList()..sort();
              if (sorted.isEmpty) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Wrap(spacing: 6, children: [
                  for (final s in sorted.take(4))
                    GestureDetector(
                      onTap: () => setState(() => item.priceController.text = MoneyInputFormatter.format(s.toDouble())),
                      child: Chip(label: Text(Formatters.currency(s.toDouble()), style: const TextStyle(fontSize: 11)),
                          visualDensity: VisualDensity.compact, materialTapTargetSize: MaterialTapTargetSize.shrinkWrap, padding: EdgeInsets.zero),
                    ),
                ]),
              );
            }),
            const SizedBox(height: 8),

            // Has glass / Has box - checkboxes
            Row(
              children: [
                Expanded(
                  child: CheckboxListTile(
                    title: const Text('Có ly', style: TextStyle(fontSize: 14)),
                    value: item.hasGlass,
                    onChanged: (v) => setState(() => item.hasGlass = v ?? false),
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                  ),
                ),
                Expanded(
                  child: CheckboxListTile(
                    title: const Text('Có hộp', style: TextStyle(fontSize: 14)),
                    value: item.hasBox,
                    onChanged: (v) => setState(() => item.hasBox = v ?? false),
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                  ),
                ),
              ],
            ),

            // Line total
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Text('Thành tiền: ',
                    style: Theme.of(context).textTheme.bodySmall),
                Text(
                  Formatters.currency(
                    (int.tryParse(item.quantityController.text) ?? 0) *
                    MoneyInputFormatter.parse(item.priceController.text),
                  ),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTotalsSection() {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            TextFormField(
              controller: _shippingFeeController,
              keyboardType: TextInputType.number,
              inputFormatters: [MoneyInputFormatter()],
              decoration: const InputDecoration(
                labelText: 'Phí ship', isDense: true, suffixText: '₫',
                prefixIcon: Icon(Icons.local_shipping_outlined),
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Tổng SP:', style: Theme.of(context).textTheme.bodyMedium),
                Text(Formatters.currency(_itemsTotal)),
              ],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Phí ship:', style: Theme.of(context).textTheme.bodyMedium),
                Text(Formatters.currency(_shippingFee)),
              ],
            ),
            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('TỔNG CỘNG',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.bold)),
                Text(Formatters.currency(_grandTotal),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: Theme.of(context).colorScheme.primary)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNotesSection() {
    return Column(
      children: [
        TextFormField(
          controller: _note1Controller,
          decoration: const InputDecoration(
            labelText: 'Ghi chú 1', prefixIcon: Icon(Icons.notes_outlined),
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: _note2Controller,
          decoration: const InputDecoration(
            labelText: 'Ghi chú 2', prefixIcon: Icon(Icons.notes_outlined),
          ),
        ),
        const SizedBox(height: 12),
        // Image capture
        Row(
          children: [
            Text('Hóa đơn / Ảnh',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.outline)),
            const Spacer(),
            TextButton.icon(
              onPressed: () async {
                final picker = ImagePicker();
                final image = await picker.pickImage(source: ImageSource.camera, imageQuality: 80);
                if (image != null) setState(() => _orderImages.add(image.path));
              },
              icon: const Icon(Icons.camera_alt, size: 18),
              label: const Text('Chụp'),
            ),
            TextButton.icon(
              onPressed: () async {
                final picker = ImagePicker();
                final images = await picker.pickMultiImage(imageQuality: 80);
                setState(() {
                  for (final img in images) {
                    _orderImages.add(img.path);
                  }
                });
              },
              icon: const Icon(Icons.photo_library, size: 18),
              label: const Text('Thư viện'),
            ),
          ],
        ),
        if (_orderImages.isNotEmpty)
          SizedBox(
            height: 70,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _orderImages.length,
              itemBuilder: (context, index) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Stack(
                  children: [
                    Container(
                      width: 70, height: 70,
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.image, size: 28),
                    ),
                    Positioned(
                      top: 0, right: 0,
                      child: GestureDetector(
                        onTap: () => setState(() => _orderImages.removeAt(index)),
                        child: Container(
                          padding: const EdgeInsets.all(2),
                          decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                          child: const Icon(Icons.close, size: 12, color: Colors.white),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  void _addLineItem() {
    setState(() => _lineItems.add(_SalesLineItem()));
  }

  String _getProductSku(String productId) {
    final provider = context.read<WineProductProvider>();
    final product = provider.products.where((p) => p.id == productId).firstOrNull;
    return product?.sku ?? '';
  }

  void _showAddColorDialog(WineProductProvider provider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          final colors = provider.allVariantOptions.where((c) => c.id != 'wvo_none').toList();
          return Padding(
            padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: MediaQuery.of(ctx).viewInsets.bottom + 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Text('Quản lý màu sắc', style: Theme.of(context).textTheme.titleMedium),
                    const Spacer(),
                    TextButton.icon(
                      onPressed: () {
                        final ctrl = TextEditingController();
                        showDialog(
                          context: context,
                          builder: (dlg) => AlertDialog(
                            title: const Text('Thêm màu mới'),
                            content: TextField(controller: ctrl, autofocus: true, decoration: const InputDecoration(hintText: 'Tên màu...')),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(dlg), child: const Text('Hủy')),
                              FilledButton(onPressed: () async {
                                if (ctrl.text.trim().isEmpty) return;
                                await provider.addVariantOption(WineVariantOption(id: '', variantTypeId: 'wvt_color', name: ctrl.text.trim()));
                                if (dlg.mounted) Navigator.pop(dlg);
                                setSheetState(() {});
                              }, child: const Text('Thêm')),
                            ],
                          ),
                        );
                      },
                      icon: const Icon(Icons.add, size: 16),
                      label: const Text('Thêm'),
                    ),
                  ],
                ),
                const Divider(),
                if (colors.isEmpty)
                  const Padding(padding: EdgeInsets.all(16), child: Text('Chưa có màu nào'))
                else
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 300),
                    child: ListView.builder(
                      shrinkWrap: true,
                      itemCount: colors.length,
                      itemBuilder: (ctx, i) {
                        final color = colors[i];
                        return ListTile(
                          dense: true,
                          leading: Container(width: 24, height: 24, decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.primaryContainer,
                            borderRadius: BorderRadius.circular(12),
                          ), child: Center(child: Text('${i + 1}', style: const TextStyle(fontSize: 11)))),
                          title: Text(color.name),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.edit, size: 18),
                                onPressed: () {
                                  final ctrl = TextEditingController(text: color.name);
                                  showDialog(
                                    context: context,
                                    builder: (dlg) => AlertDialog(
                                      title: const Text('Sửa tên màu'),
                                      content: TextField(controller: ctrl, autofocus: true),
                                      actions: [
                                        TextButton(onPressed: () => Navigator.pop(dlg), child: const Text('Hủy')),
                                        FilledButton(onPressed: () async {
                                          if (ctrl.text.trim().isEmpty) return;
                                          await provider.updateVariantOption(color.copyWith(name: ctrl.text.trim()));
                                          if (dlg.mounted) Navigator.pop(dlg);
                                          setSheetState(() {});
                                        }, child: const Text('Lưu')),
                                      ],
                                    ),
                                  );
                                },
                              ),
                              IconButton(
                                icon: const Icon(Icons.delete, size: 18, color: Colors.red),
                                onPressed: () async {
                                  final confirm = await showDialog<bool>(
                                    context: context,
                                    builder: (dlg) => AlertDialog(
                                      title: const Text('Xóa màu'),
                                      content: Text('Xóa "${color.name}"?'),
                                      actions: [
                                        TextButton(onPressed: () => Navigator.pop(dlg, false), child: const Text('Hủy')),
                                        FilledButton(
                                          onPressed: () => Navigator.pop(dlg, true),
                                          style: FilledButton.styleFrom(backgroundColor: Colors.red),
                                          child: const Text('Xóa'),
                                        ),
                                      ],
                                    ),
                                  );
                                  if (confirm == true) {
                                    await provider.deleteVariantOption(color.id);
                                    setSheetState(() {});
                                  }
                                },
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                const SizedBox(height: 8),
              ],
            ),
          );
        },
      ),
    ).then((_) => setState(() {})); // Refresh main screen after closing
  }

  void _showProductPicker(List<WineProduct> products, int lineIndex) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        String query = '';
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            final filtered = query.isEmpty
                ? products
                : products.where((p) =>
                    p.name.toLowerCase().contains(query.toLowerCase()) ||
                    p.sku.toLowerCase().contains(query.toLowerCase())).toList();

            return DraggableScrollableSheet(
              initialChildSize: 0.7,
              minChildSize: 0.4,
              maxChildSize: 0.9,
              expand: false,
              builder: (ctx, scrollController) {
                return Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: TextField(
                        autofocus: true,
                        decoration: InputDecoration(
                          hintText: 'Tìm theo tên hoặc SKU...',
                          prefixIcon: const Icon(Icons.search),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          isDense: true,
                        ),
                        onChanged: (v) => setSheetState(() => query = v),
                      ),
                    ),
                    Expanded(
                      child: ListView.builder(
                        controller: scrollController,
                        itemCount: filtered.length,
                        itemBuilder: (ctx, i) {
                          final product = filtered[i];
                          return ListTile(
                            leading: CircleAvatar(
                              radius: 18,
                              backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                              child: Text(product.sku.substring(0, product.sku.length > 2 ? 2 : product.sku.length),
                                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                            ),
                            title: Text(product.name),
                            subtitle: Text('SKU: ${product.sku}'),
                            onTap: () {
                              setState(() {
                                _lineItems[lineIndex].selectedProductId = product.id;
                                _lineItems[lineIndex].selectedVariantId = null;
                              });
                              _loadVariantsForItem(product.id, lineIndex);
                              Navigator.pop(ctx);
                            },
                          );
                        },
                      ),
                    ),
                  ],
                );
              },
            );
          },
        );
      },
    );
  }

  Future<void> _loadVariantsForItem(String productId, int index) async {
    final provider = context.read<WineProductProvider>();
    await provider.selectProduct(productId);
    if (mounted && provider.selectedProduct?.variants != null) {
      setState(() {
        _lineItems[index].availableVariants = provider.selectedProduct!.variants!;
      });
    }
  }

  void _showCustomerPicker(List<WineCustomer> customers) {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => ListView.builder(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: customers.length,
        itemBuilder: (ctx, index) {
          final c = customers[index];
          return ListTile(
            title: Text(c.name),
            subtitle: Text(c.phone ?? ''),
            onTap: () {
              setState(() {
                _selectedCustomerId = c.id;
                _customerNameController.text = c.name;
                _customerPhoneController.text = c.phone ?? '';
                _customerAddressController.text = c.address ?? '';
              });
              Navigator.pop(ctx);
            },
          );
        },
      ),
    );
  }

  Future<void> _save() async {
    // Validate line items - skip validation for lines with no product selected
    bool hasAtLeastOneValid = false;
    for (int i = 0; i < _lineItems.length; i++) {
      final item = _lineItems[i];
      if (item.selectedProductId != null && (int.tryParse(item.quantityController.text) ?? 0) > 0) {
        hasAtLeastOneValid = true;
      }
    }
    if (!hasAtLeastOneValid) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Vui lòng chọn ít nhất 1 sản phẩm và nhập số lượng'),
        behavior: SnackBarBehavior.floating,
      ));
      return;
    }

    setState(() => _isLoading = true);

    try {
      final stockProvider = context.read<WineStockProvider>();

      final order = WineSalesOrder(
        id: _isEditing ? widget.editOrder!.id : _uuid.v4(),
        date: _selectedDate,
        customerId: _selectedCustomerId,
        customerName: _customerNameController.text.trim().isEmpty
            ? null : _customerNameController.text.trim(),
        customerPhone: _customerPhoneController.text.trim().isEmpty
            ? null : _customerPhoneController.text.trim(),
        customerAddress: _customerAddressController.text.trim().isEmpty
            ? null : _customerAddressController.text.trim(),
        shippingFee: _shippingFee,
        note1: _note1Controller.text.trim().isEmpty
            ? null : _note1Controller.text.trim(),
        note2: _note2Controller.text.trim().isEmpty
            ? null : _note2Controller.text.trim(),
        images: _orderImages.isEmpty ? null : _orderImages.join(','),
      );

      final items = <WineSalesOrderItem>[];
      for (final item in _lineItems) {
        if (item.selectedProductId == null) continue;
        final qty = int.tryParse(item.quantityController.text) ?? 0;
        if (qty <= 0) continue;

        // Determine variant: use existing variant if available, or create one based on color selection
        String? variantId;

        // Check if product already has a variant matching selected color
        if (item.selectedColorOptionId != null && item.availableVariants.isNotEmpty) {
          final match = item.availableVariants.where(
              (v) => v.variantOptionId == item.selectedColorOptionId).firstOrNull;
          if (match != null) variantId = match.id;
        }

        // If no existing variant, try first available
        if (variantId == null && item.availableVariants.isNotEmpty) {
          variantId = item.availableVariants.first.id;
        }

        // If still null, create a new variant for this product
        if (variantId == null) {
          final colorId = item.selectedColorOptionId ?? 'wvo_none';
          final productProvider = context.read<WineProductProvider>();
          final newVariant = await productProvider.addVariant(WineProductVariant(
            id: '',
            productId: item.selectedProductId!,
            variantOptionId: colorId,
          ));
          variantId = newVariant.id;
        }

        items.add(WineSalesOrderItem(
          id: '',
          salesOrderId: '',
          productVariantId: variantId,
          quantity: qty,
          price: MoneyInputFormatter.parse(item.priceController.text),
          hasGlass: item.hasGlass ? 1 : 0,
          hasBox: item.hasBox ? 1 : 0,
        ));
      }

      if (items.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Vui lòng chọn sản phẩm và nhập số lượng'),
            behavior: SnackBarBehavior.floating,
          ));
          setState(() => _isLoading = false);
        }
        return;
      }

      if (_isEditing) {
        // Delete old items and update order
        final db = await DatabaseHelper.instance.database;
        await db.delete('wine_sales_order_items',
            where: 'sales_order_id = ?', whereArgs: [order.id]);
        await db.update('wine_sales_orders', order.toMap(),
            where: 'id = ?', whereArgs: [order.id]);
        // Re-insert items
        for (final item in items) {
          final itemWithOrder = WineSalesOrderItem(
            id: _uuid.v4(),
            salesOrderId: order.id,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            price: item.price,
            hasGlass: item.hasGlass,
            hasBox: item.hasBox,
          );
          await db.insert('wine_sales_order_items', itemWithOrder.toMap());
        }
        await stockProvider.loadSalesOrders();
        await stockProvider.loadInventory();
      } else {
        await stockProvider.createSalesOrder(order, items);
      }

      // Auto-save customer info for future suggestions
      if (_customerNameController.text.trim().isNotEmpty) {
        final customerProvider = context.read<WineCustomerProvider>();
        await customerProvider.addCustomer(WineCustomer(
          id: '',
          name: _customerNameController.text.trim(),
          phone: _customerPhoneController.text.trim().isEmpty ? null : _customerPhoneController.text.trim(),
          address: _customerAddressController.text.trim().isEmpty ? null : _customerAddressController.text.trim(),
        ));
      }

      if (mounted) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(_isEditing ? 'Đã cập nhật phiếu bán hàng' : 'Đã tạo phiếu bán hàng (tồn kho đã được trừ)'),
          behavior: SnackBarBehavior.floating,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Có lỗi xảy ra: ${e.toString().replaceAll('Null check operator used on a null value', 'Dữ liệu chưa đầy đủ, vui lòng kiểm tra lại')}'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }
}

class _SalesLineItem {
  String? selectedProductId;
  String? selectedVariantId;
  String? selectedColorOptionId;
  final TextEditingController quantityController = TextEditingController();
  final TextEditingController priceController = TextEditingController();
  bool hasGlass = false;
  bool hasBox = false;
  List<WineProductVariant> availableVariants = [];

  void dispose() {
    quantityController.dispose();
    priceController.dispose();
  }
}
