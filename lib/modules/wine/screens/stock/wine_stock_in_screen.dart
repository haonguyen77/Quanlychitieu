import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import 'package:intl/intl.dart';
import '../../models/wine_product.dart';
import '../../models/wine_stock_in.dart';
import '../../providers/wine_product_provider.dart';
import '../../providers/wine_stock_provider.dart';

class WineStockInScreen extends StatefulWidget {
  const WineStockInScreen({super.key});

  @override
  State<WineStockInScreen> createState() => _WineStockInScreenState();
}

class _WineStockInScreenState extends State<WineStockInScreen> {
  static const _purple = Color(0xFF6C2BD9);
  static const _darkBlue = Color(0xFF0F1F4D);

  final _uuid = const Uuid();
  DateTime _selectedDate = DateTime.now();
  final List<_StockInEntry> _entries = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    // Add first entry by default
    _entries.add(_StockInEntry());
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<WineProductProvider>().loadProducts();
      context.read<WineProductProvider>().loadVariantTypes();
    });
  }

  @override
  void dispose() {
    for (final entry in _entries) {
      entry.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    _buildDateSelector(),
                    const SizedBox(height: 16),
                    // Entries
                    for (int i = 0; i < _entries.length; i++) _buildEntryBlock(i),
                    const SizedBox(height: 16),
                    _buildAddMoreButton(),
                    const SizedBox(height: 24),
                    _buildActionButtons(),
                    const SizedBox(height: 16),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios, size: 20, color: _darkBlue),
            onPressed: () => Navigator.pop(context),
          ),
          const Expanded(
            child: Text(
              'Nhập kho',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: _darkBlue,
              ),
            ),
          ),
          const SizedBox(width: 48), // balance the back button
        ],
      ),
    );
  }

  Widget _buildDateSelector() {
    final dateStr = DateFormat('dd/MM/yyyy').format(_selectedDate);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => _changeDate(-1),
            child: const Icon(Icons.chevron_left, color: _purple, size: 26),
          ),
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.calendar_today, size: 18, color: _purple),
                const SizedBox(width: 8),
                Text(
                  dateStr,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: _darkBlue),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => _changeDate(1),
            child: const Icon(Icons.chevron_right, color: _purple, size: 26),
          ),
        ],
      ),
    );
  }

  void _changeDate(int days) {
    setState(() {
      _selectedDate = _selectedDate.add(Duration(days: days));
    });
  }

  Widget _buildEntryBlock(int index) {
    final entry = _entries[index];
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        children: [
          if (_entries.length > 1)
            Row(
              children: [
                Text('Sản phẩm ${index + 1}',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _darkBlue)),
                const Spacer(),
                if (_entries.length > 1)
                  IconButton(
                    icon: const Icon(Icons.close, size: 18, color: Colors.red),
                    onPressed: () {
                      setState(() {
                        _entries[index].dispose();
                        _entries.removeAt(index);
                      });
                    },
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
          const SizedBox(height: 4),
          // Product search field
          _buildProductField(entry),
          const SizedBox(height: 12),
          // Quantity field
          _buildQuantityField(entry),
          const SizedBox(height: 12),
          // Color dropdown
          _buildColorDropdown(entry),
          const SizedBox(height: 12),
          // Note field
          _buildNoteField(entry),
        ],
      ),
    );
  }

  Widget _buildProductField(_StockInEntry entry) {
    return Consumer<WineProductProvider>(
      builder: (context, provider, _) {
        return Autocomplete<WineProduct>(
          displayStringForOption: (product) => '${product.sku} - ${product.name}',
          optionsBuilder: (textEditingValue) {
            if (textEditingValue.text.isEmpty) return provider.products;
            final query = textEditingValue.text.toLowerCase();
            return provider.products.where((p) =>
                p.sku.toLowerCase().contains(query) ||
                p.name.toLowerCase().contains(query));
          },
          onSelected: (product) {
            setState(() {
              entry.selectedProduct = product;
              entry.productController.text = '${product.sku} - ${product.name}';
              _loadVariantsForEntry(product.id, entry);
            });
          },
          fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
            // Sync controller with entry
            if (entry.productController.text.isNotEmpty && controller.text.isEmpty) {
              controller.text = entry.productController.text;
            }
            entry.productController = controller;
            return Container(
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: Colors.grey.shade300),
                borderRadius: BorderRadius.circular(10),
              ),
              child: TextField(
                controller: controller,
                focusNode: focusNode,
                decoration: InputDecoration(
                  hintText: 'Tìm theo SKU hoặc tên sản phẩm...',
                  hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
                  prefixIcon: Icon(Icons.search, color: Colors.grey.shade400, size: 20),
                  suffixIcon: const Icon(Icons.arrow_drop_down, color: _purple, size: 24),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 14),
                  filled: true,
                  fillColor: Colors.white,
                ),
              ),
            );
          },
          optionsViewBuilder: (context, onSelected, options) {
            return Align(
              alignment: Alignment.topLeft,
              child: Material(
                elevation: 4,
                borderRadius: BorderRadius.circular(8),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: 200,
                    maxWidth: MediaQuery.of(context).size.width - 64,
                  ),
                  child: ListView.builder(
                    padding: EdgeInsets.zero,
                    shrinkWrap: true,
                    itemCount: options.length,
                    itemBuilder: (context, index) {
                      final product = options.elementAt(index);
                      return ListTile(
                        dense: true,
                        title: Text('${product.sku} - ${product.name}',
                            style: const TextStyle(fontSize: 14)),
                        onTap: () => onSelected(product),
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

  Widget _buildQuantityField(_StockInEntry entry) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: entry.quantityController,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: InputDecoration(
                hintText: 'Nhập số lượng',
                hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              ),
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              GestureDetector(
                onTap: () => _incrementQuantity(entry, 1),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                  child: Icon(Icons.keyboard_arrow_up, size: 20, color: _purple),
                ),
              ),
              GestureDetector(
                onTap: () => _incrementQuantity(entry, -1),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                  child: Icon(Icons.keyboard_arrow_down, size: 20, color: _purple),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _incrementQuantity(_StockInEntry entry, int delta) {
    final current = int.tryParse(entry.quantityController.text) ?? 0;
    final newVal = (current + delta).clamp(0, 99999);
    entry.quantityController.text = newVal.toString();
    setState(() {});
  }

  Widget _buildColorDropdown(_StockInEntry entry) {
    return Consumer<WineProductProvider>(
      builder: (context, provider, _) {
        // Use allVariantOptions from provider for colors
        final colorOptions = provider.allVariantOptions.where((c) => c.id != 'wvo_none').toList();

        // If product is selected, show its variants; otherwise show color options
        final hasVariants = entry.availableVariants.isNotEmpty;

        return Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: Colors.grey.shade300),
            borderRadius: BorderRadius.circular(10),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: DropdownButtonHideUnderline(
            child: hasVariants
                ? DropdownButton<String>(
                    value: entry.selectedVariantId,
                    isExpanded: true,
                    hint: Text(
                      'Chọn màu sắc',
                      style: TextStyle(color: Colors.grey.shade400, fontSize: 14),
                    ),
                    icon: const Icon(Icons.arrow_drop_down, color: _purple),
                    dropdownColor: Colors.white,
                    items: entry.availableVariants.map((v) {
                      return DropdownMenuItem(
                        value: v.id,
                        child: Text(v.variantName ?? v.id, style: const TextStyle(fontSize: 14, color: _darkBlue)),
                      );
                    }).toList(),
                    onChanged: (value) {
                      setState(() => entry.selectedVariantId = value);
                    },
                  )
                : DropdownButton<String>(
                    value: entry.selectedColorOptionId,
                    isExpanded: true,
                    hint: Text(
                      'Chọn màu sắc',
                      style: TextStyle(color: Colors.grey.shade400, fontSize: 14),
                    ),
                    icon: const Icon(Icons.arrow_drop_down, color: _purple),
                    dropdownColor: Colors.white,
                    items: colorOptions.map((c) {
                      return DropdownMenuItem(
                        value: c.id,
                        child: Text(c.name, style: const TextStyle(fontSize: 14, color: _darkBlue)),
                      );
                    }).toList(),
                    onChanged: (value) {
                      setState(() => entry.selectedColorOptionId = value);
                    },
                  ),
          ),
        );
      },
    );
  }

  Widget _buildNoteField(_StockInEntry entry) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Stack(
        children: [
          TextField(
            controller: entry.noteController,
            maxLines: 3,
            maxLength: 200,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: 'Nhập ghi chú...',
              hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
              counterText: '',
            ),
          ),
          Positioned(
            right: 12,
            bottom: 8,
            child: Text(
              '${entry.noteController.text.length}/200',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade400),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAddMoreButton() {
    return GestureDetector(
      onTap: () {
        setState(() => _entries.add(_StockInEntry()));
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          border: Border.all(color: _purple),
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add, color: _purple, size: 20),
            SizedBox(width: 8),
            Text(
              'Thêm sản phẩm khác',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: _purple,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButtons() {
    return Row(
      children: [
        Expanded(
          child: GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade300),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Center(
                child: Text(
                  'Hủy',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: _darkBlue,
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: GestureDetector(
            onTap: _isLoading ? null : _save,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: _purple,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (_isLoading)
                    const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  else
                    const Icon(Icons.login, color: Colors.white, size: 20),
                  const SizedBox(width: 8),
                  const Text(
                    'Nhập kho',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
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

  Future<void> _loadVariantsForEntry(String productId, _StockInEntry entry) async {
    final provider = context.read<WineProductProvider>();
    await provider.selectProduct(productId);
    if (mounted) {
      final variants = provider.selectedProduct?.variants ?? [];
      setState(() {
        entry.availableVariants = variants;
        if (variants.isNotEmpty) {
          entry.selectedVariantId = variants.first.id;
        }
      });
    }
  }

  Future<String> _ensureDefaultVariant(String productId) async {
    final provider = context.read<WineProductProvider>();
    await provider.selectProduct(productId);
    final variants = provider.selectedProduct?.variants ?? [];
    if (variants.isNotEmpty) return variants.first.id;

    final defaultVariant = await provider.addVariant(WineProductVariant(
      id: '',
      productId: productId,
      variantOptionId: 'wvo_none',
    ));
    return defaultVariant.id;
  }

  Future<void> _save() async {
    // Validate entries
    for (int i = 0; i < _entries.length; i++) {
      final entry = _entries[i];
      if (entry.selectedProduct == null) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('${_entries.length > 1 ? "SP ${i + 1}: " : ""}Vui lòng chọn sản phẩm'),
          behavior: SnackBarBehavior.floating,
        ));
        return;
      }
      if (entry.selectedVariantId == null) {
        // Try to resolve from color option
        if (entry.selectedColorOptionId != null && entry.selectedProduct != null) {
          final productProvider = context.read<WineProductProvider>();
          await productProvider.selectProduct(entry.selectedProduct!.id);
          final variants = productProvider.selectedProduct?.variants ?? [];
          final match = variants.where((v) => v.variantOptionId == entry.selectedColorOptionId).firstOrNull;
          if (match != null) {
            entry.selectedVariantId = match.id;
          } else {
            // Create variant with this color
            final newVariant = await productProvider.addVariant(WineProductVariant(
              id: '',
              productId: entry.selectedProduct!.id,
              variantOptionId: entry.selectedColorOptionId!,
            ));
            entry.selectedVariantId = newVariant.id;
          }
        } else {
          final variantId = await _ensureDefaultVariant(entry.selectedProduct!.id);
          entry.selectedVariantId = variantId;
        }
      }
      final qty = int.tryParse(entry.quantityController.text) ?? 0;
      if (qty <= 0) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('${_entries.length > 1 ? "SP ${i + 1}: " : ""}Số lượng phải > 0'),
          behavior: SnackBarBehavior.floating,
        ));
        return;
      }
    }

    setState(() => _isLoading = true);

    try {
      final stockProvider = context.read<WineStockProvider>();

      final stockIn = WineStockIn(
        id: _uuid.v4(),
        date: _selectedDate,
        note: null,
      );

      final items = _entries.map((entry) => WineStockInItem(
        id: '',
        stockInId: '',
        productVariantId: entry.selectedVariantId!,
        quantity: int.parse(entry.quantityController.text),
        note: entry.noteController.text.trim().isEmpty ? null : entry.noteController.text.trim(),
      )).toList();

      await stockProvider.createStockIn(stockIn, items);

      if (mounted) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Đã tạo phiếu nhập kho'),
          behavior: SnackBarBehavior.floating,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Lỗi: $e'),
          backgroundColor: Colors.red,
        ));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }
}

class _StockInEntry {
  WineProduct? selectedProduct;
  TextEditingController productController = TextEditingController();
  final TextEditingController quantityController = TextEditingController();
  final TextEditingController noteController = TextEditingController();
  String? selectedVariantId;
  String? selectedColorOptionId;
  List<WineProductVariant> availableVariants = [];

  void dispose() {
    quantityController.dispose();
    noteController.dispose();
  }
}
