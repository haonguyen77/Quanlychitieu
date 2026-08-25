import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/wine_data_provider.dart';
import '../../services/wine_color_service.dart';

/// Wine Order Create/Edit — reads/writes directly to records table.
/// Matches EXT's WineOrderForm exactly: customer info, products, notes, ship fee.
class WineOrderFormScreen extends StatefulWidget {
  final String? editOrderId;
  const WineOrderFormScreen({super.key, this.editOrderId});

  @override
  State<WineOrderFormScreen> createState() => _WineOrderFormScreenState();
}

class _WineOrderFormScreenState extends State<WineOrderFormScreen> {
  static const _purple = Color(0xFF6C2BD9);
  static const _navy = Color(0xFF101B4D);
  static const _border = Color(0xFFE5E7EB);

  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _wardCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _shipFeeCtrl = TextEditingController();
  final _note1Ctrl = TextEditingController();
  final _note2Ctrl = TextEditingController();

  // Stable focus nodes (never recreate in build → keeps focus + autocomplete
  // overlay alive while typing).
  final _nameFocus = FocusNode();
  final _phoneFocus = FocusNode();
  final _addressFocus = FocusNode();
  final _wardFocus = FocusNode();
  final _cityFocus = FocusNode();
  final _shipFeeFocus = FocusNode();

  DateTime _date = DateTime.now();
  List<_ProductLine> _lines = [_ProductLine()];

  // Inline customer suggestions (reliable: rendered directly in the tree, not
  // via an overlay). _suggestField is which field is active ('name'|'phone'|
  // 'address'|'ward'|'city'), _suggestions is the list to show under it.
  String? _suggestField;
  List<Map<String, dynamic>> _suggestions = [];

  bool get _isEditing => widget.editOrderId != null;
  Map<String, dynamic>? _editOrder;

  void _rebuild() { if (mounted) setState(() {}); }

  @override
  void initState() {
    super.initState();
    WineColorService.instance.getColors(); // Pre-load colors
    // Rebuild when money fields gain/lose focus so their suggestion chips
    // show/hide correctly.
    _shipFeeFocus.addListener(_rebuild);
    for (final l in _lines) { l.priceFocus.addListener(_rebuild); }
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      // Load customers + products so autocomplete/suggestions have data.
      final provider = context.read<WineDataProvider>();
      await provider.loadCustomers();
      await provider.loadProducts();
      if (mounted) setState(() {});
      if (_isEditing) await _loadOrder();
    });
  }

  Future<void> _loadOrder() async {
    final provider = context.read<WineDataProvider>();
    await provider.loadOrders();
    await provider.loadProducts();
    final order = provider.orders.firstWhere((o) => o['id'] == widget.editOrderId, orElse: () => <String, dynamic>{});
    if (order.isEmpty) return;
    _editOrder = order;

    setState(() {
      _nameCtrl.text = order['customer_name'] as String? ?? '';
      _phoneCtrl.text = order['customer_phone'] as String? ?? '';
      _addressCtrl.text = order['customer_address'] as String? ?? '';
      _wardCtrl.text = order['customer_district'] as String? ?? '';
      _cityCtrl.text = order['customer_city'] as String? ?? '';
      _note1Ctrl.text = order['note1'] as String? ?? '';
      _note2Ctrl.text = order['note2'] as String? ?? '';
      final shipFee = order['ship_fee'];
      _shipFeeCtrl.text = shipFee != null && shipFee != 0
          ? NumberFormat('#,###', 'vi_VN').format((shipFee as num).toInt())
          : '';
      try { _date = DateTime.parse(order['order_date'] as String); } catch (_) {}

      // Parse product lines
      _lines = [];
      final plRaw = order['product_lines'];
      if (plRaw != null && plRaw is String && plRaw.isNotEmpty) {
        try {
          final parsed = List<dynamic>.from(jsonDecode(plRaw));
          for (final p in parsed) {
            _lines.add(_ProductLine(
              name: p['productName'] as String? ?? '',
              sku: p['productSku'] as String? ?? '',
              qty: int.tryParse(p['quantity']?.toString() ?? '1') ?? 1,
              price: double.tryParse(p['price']?.toString() ?? '0') ?? 0,
              color: p['color'] as String? ?? '',
            ));
          }
        } catch (_) {}
      }
      if (_lines.isEmpty) {
        _lines.add(_ProductLine(
          name: order['product_name'] as String? ?? '',
          sku: order['product_sku'] as String? ?? '',
          qty: int.tryParse(order['quantity']?.toString() ?? '1') ?? 1,
          price: double.tryParse(order['price']?.toString() ?? '0') ?? 0,
          color: order['color'] as String? ?? '',
        ));
      }
      if (_lines.isEmpty) _lines.add(_ProductLine());
      for (final l in _lines) { l.priceFocus.addListener(_rebuild); }
    });
  }

  @override
  void dispose() {
    _nameCtrl.dispose(); _phoneCtrl.dispose(); _addressCtrl.dispose();
    _wardCtrl.dispose(); _cityCtrl.dispose(); _shipFeeCtrl.dispose();
    _note1Ctrl.dispose(); _note2Ctrl.dispose();
    _nameFocus.dispose(); _phoneFocus.dispose(); _addressFocus.dispose();
    _wardFocus.dispose(); _cityFocus.dispose(); _shipFeeFocus.dispose();
    for (final l in _lines) { l.priceCtrl.dispose(); l.qtyCtrl.dispose(); l.priceFocus.dispose(); }
    super.dispose();
  }

  double get _totalGoods => _lines.fold(0, (s, l) => s + l.qty * l.price);
  double get _shipFee => double.tryParse(_shipFeeCtrl.text.replaceAll('.', '').replaceAll(',', '')) ?? 0;
  double get _grandTotal => _totalGoods + _shipFee;

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Vui lòng nhập tên khách hàng')));
      return;
    }

    final provider = context.read<WineDataProvider>();
    final validLines = _lines.where((l) => l.name.isNotEmpty && l.qty > 0).toList();
    final firstLine = validLines.isNotEmpty ? validLines.first : _ProductLine();

    final values = <String, dynamic>{
      'mod_ruou_order_date': DateFormat('yyyy-MM-dd').format(_date),
      'mod_ruou_customer_name': _nameCtrl.text.trim(),
      'mod_ruou_customer_phone': _phoneCtrl.text.trim(),
      'mod_ruou_customer_address': _addressCtrl.text.trim(),
      'mod_ruou_customer_district': _wardCtrl.text.trim(),
      'mod_ruou_customer_city': _cityCtrl.text.trim(),
      'mod_ruou_product_sku': firstLine.sku,
      'mod_ruou_product_name': firstLine.name,
      'mod_ruou_color': firstLine.color,
      'mod_ruou_quantity': firstLine.qty,
      'mod_ruou_price': firstLine.price,
      'mod_ruou_glasses': 0,
      'mod_ruou_boxes': 0,
      'mod_ruou_ship_fee': _shipFee,
      'mod_ruou_total_amount': _grandTotal,
      'mod_ruou_note1': _note1Ctrl.text.trim(),
      'mod_ruou_note2': _note2Ctrl.text.trim(),
    };

    // Multi-product: store as product_lines JSON
    if (validLines.length > 1) {
      values['mod_ruou_product_lines'] = jsonEncode(validLines.map((l) => {
        'productName': l.name, 'productSku': l.sku,
        'quantity': l.qty.toString(), 'price': l.price.toString(),
        'color': l.color, 'glasses': '0', 'boxes': '0',
      }).toList());
    }

    if (_isEditing) {
      // Get old values for inventory adjustment
      final oldValues = _editOrder?['_raw_values'] as Map<String, dynamic>?;
      await provider.updateOrder(widget.editOrderId!, values, oldValues: oldValues);
    } else {
      await provider.createOrder(values);
    }

    if (mounted) Navigator.pop(context, true);
  }

  Future<void> _delete() async {
    if (!_isEditing) return;
    final confirmed = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Xóa đơn hàng?'), actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
        TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Xóa', style: TextStyle(color: Colors.red))),
      ],
    ));
    if (confirmed == true) {
      await context.read<WineDataProvider>().deleteOrder(widget.editOrderId!);
      if (mounted) Navigator.pop(context, true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final nf = NumberFormat('#,###', 'vi_VN');
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: _navy), onPressed: () => Navigator.pop(context)),
        title: Text(_isEditing ? 'Sửa đơn hàng' : 'Tạo đơn hàng mới', style: const TextStyle(color: _navy, fontWeight: FontWeight.bold, fontSize: 18)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Date
          Row(children: [
            IconButton(icon: const Icon(Icons.chevron_left), onPressed: () => setState(() => _date = _date.subtract(const Duration(days: 1)))),
            Expanded(child: GestureDetector(
              onTap: () async {
                final picked = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime(2099));
                if (picked != null) setState(() => _date = picked);
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                alignment: Alignment.center,
                decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(8)),
                child: Text('📅 ${DateFormat('dd/MM/yyyy').format(_date)}', style: const TextStyle(fontSize: 14)),
              ),
            )),
            IconButton(icon: const Icon(Icons.chevron_right), onPressed: () => setState(() => _date = _date.add(const Duration(days: 1)))),
          ]),
          const SizedBox(height: 12),
          // Customer info — suggest from existing customers (inline dropdown).
          _suggestField_(
            fkey: 'name', icon: Icons.person_outline, hint: 'Tên khách hàng...',
            controller: _nameCtrl, focusNode: _nameFocus, matchKey: 'full_name',
          ),
          const SizedBox(height: 10),
          _suggestField_(
            fkey: 'phone', icon: Icons.phone_outlined, hint: 'Số điện thoại...',
            controller: _phoneCtrl, focusNode: _phoneFocus, matchKey: 'phone',
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 10),
          _suggestField_(
            fkey: 'address', icon: Icons.location_on_outlined, hint: 'Nhập địa chỉ...',
            controller: _addressCtrl, focusNode: _addressFocus, matchKey: 'address',
          ),
          const SizedBox(height: 10),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: _suggestField_(
              fkey: 'ward', icon: Icons.map_outlined, hint: 'Phường/Xã...',
              controller: _wardCtrl, focusNode: _wardFocus, matchKey: 'district', fillOnly: true,
            )),
            const SizedBox(width: 8),
            Expanded(child: _suggestField_(
              fkey: 'city', icon: Icons.location_city_outlined, hint: 'Thành phố...',
              controller: _cityCtrl, focusNode: _cityFocus, matchKey: 'city', fillOnly: true,
            )),
          ]),
          const SizedBox(height: 16),
          // Products
          Row(children: [
            const Text('Sản phẩm', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _navy)),
            const Spacer(),
            TextButton.icon(
              onPressed: () => setState(() {
                final line = _ProductLine();
                line.priceFocus.addListener(_rebuild);
                _lines.add(line);
              }),
              icon: const Icon(Icons.add, size: 16), label: const Text('Thêm SP', style: TextStyle(fontSize: 12)),
            ),
          ]),
          ...List.generate(_lines.length, (i) => _buildProductLine(i)),
          const SizedBox(height: 12),
          // Totals
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('Tổng tiền:', style: TextStyle(fontWeight: FontWeight.w500)),
            Text('${nf.format(_totalGoods.toInt())} đ', style: const TextStyle(fontWeight: FontWeight.bold, color: _purple)),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            const Text('Phí ship:'),
            const Spacer(),
            SizedBox(width: 130, child: _moneySuggestField(
              label: 'Phí ship',
              controller: _shipFeeCtrl,
              focusNode: _shipFeeFocus,
              onValue: (_) => setState(() {}),
            )),
          ]),
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('Thanh toán:', style: TextStyle(fontWeight: FontWeight.bold, color: _purple)),
            Text('${nf.format(_grandTotal.toInt())} đ', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: _purple)),
          ]),
          const SizedBox(height: 16),
          // Notes
          _field(Icons.edit_note, 'Ghi chú 1...', _note1Ctrl),
          _field(Icons.edit_note, 'Ghi chú 2...', _note2Ctrl),
          const SizedBox(height: 24),
          // Buttons
          Row(children: [
            if (_isEditing)
              Expanded(child: OutlinedButton.icon(
                onPressed: _delete,
                icon: const Icon(Icons.delete, color: Colors.red, size: 18),
                label: const Text('Xóa', style: TextStyle(color: Colors.red)),
                style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.red)),
              )),
            if (_isEditing) const SizedBox(width: 12),
            Expanded(flex: 2, child: FilledButton(
              onPressed: _save,
              style: FilledButton.styleFrom(
                backgroundColor: _purple,
                minimumSize: const Size.fromHeight(50),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(_isEditing ? 'Lưu đơn hàng' : 'Tạo đơn hàng',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            )),
          ]),
        ]),
      ),
    );
  }

  void _fillFromCustomer(Map<String, dynamic> c) {
    setState(() {
      _nameCtrl.text = (c['full_name'] as String?) ?? _nameCtrl.text;
      _phoneCtrl.text = (c['phone'] as String?) ?? '';
      _addressCtrl.text = (c['address'] as String?) ?? '';
      _wardCtrl.text = (c['district'] as String?) ?? '';
      _cityCtrl.text = (c['city'] as String?) ?? '';
      _suggestField = null;
      _suggestions = [];
    });
    FocusScope.of(context).unfocus();
  }

  void _onSuggestChanged(String fkey, String matchKey, String text, {required bool fillOnly}) {
    final q = text.trim().toLowerCase();
    if (q.isEmpty) {
      setState(() { _suggestField = null; _suggestions = []; });
      return;
    }
    final customers = context.read<WineDataProvider>().customers;
    final seen = <String>{};
    final matches = <Map<String, dynamic>>[];
    for (final c in customers) {
      final v = ((c[matchKey] as String?) ?? '').trim();
      if (v.isEmpty || !v.toLowerCase().contains(q)) continue;
      // Dedupe by the value shown for THIS field so we don't repeat the same
      // name/phone/address.
      if (seen.add(v.toLowerCase())) matches.add(c);
      if (matches.length >= 6) break;
    }
    setState(() { _suggestField = fkey; _suggestions = matches; });
  }

  /// A customer field with an INLINE suggestion dropdown rendered directly in
  /// the widget tree (no overlay) so it always shows. [fillOnly] = ward/city
  /// (only set that field); otherwise selecting fills the whole customer.
  Widget _suggestField_({
    required String fkey,
    required IconData icon,
    required String hint,
    required TextEditingController controller,
    required FocusNode focusNode,
    required String matchKey,
    TextInputType? keyboardType,
    bool fillOnly = false,
  }) {
    final showList = _suggestField == fkey && _suggestions.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          height: 48,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _border),
          ),
          child: Row(children: [
            const SizedBox(width: 12),
            Icon(icon, size: 18, color: Colors.grey[500]),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: controller,
                focusNode: focusNode,
                keyboardType: keyboardType,
                style: const TextStyle(fontSize: 14, color: _navy),
                onChanged: (v) => _onSuggestChanged(fkey, matchKey, v, fillOnly: fillOnly),
                decoration: InputDecoration(
                  hintText: hint,
                  hintStyle: TextStyle(fontSize: 14, color: Colors.grey[400]),
                  border: InputBorder.none,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
            Icon(Icons.expand_more, size: 20, color: Colors.grey[400]),
            const SizedBox(width: 8),
          ]),
        ),
        if (showList)
          Container(
            margin: const EdgeInsets.only(top: 2),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: _border),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 6)],
            ),
            child: Column(
              children: _suggestions.map((c) {
                // Show the value matching THIS field (name field → name, phone
                // field → phone, address field → address). Selecting fills all.
                final primary = (c[matchKey] as String?) ?? '';
                // Small secondary line for context (name field also shows phone).
                final sub = fkey == 'name'
                    ? ((c['phone'] as String?) ?? '')
                    : '';
                return InkWell(
                  onTap: () {
                    if (fillOnly) {
                      controller.text = (c[matchKey] as String?) ?? '';
                      setState(() { _suggestField = null; _suggestions = []; });
                      FocusScope.of(context).unfocus();
                    } else {
                      _fillFromCustomer(c);
                    }
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(primary, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                        if (sub.isNotEmpty)
                          Text(sub, style: TextStyle(fontSize: 12, color: Colors.grey[500])),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
      ],
    );
  }

  /// Plain money field with quick-amount suggestion chips underneath (type a
  /// few digits → tap a chip to multiply). No overlay, always visible.
  Widget _moneySuggestField({
    required String label,
    required TextEditingController controller,
    required FocusNode focusNode,
    required void Function(double) onValue,
  }) {
    final nf = NumberFormat('#,###', 'vi_VN');
    double parse(String s) => double.tryParse(s.replaceAll('.', '').replaceAll(',', '')) ?? 0;
    final raw = controller.text.replaceAll(RegExp(r'[^0-9]'), '');
    final n = int.tryParse(raw) ?? 0;
    final showChips = focusNode.hasFocus && raw.isNotEmpty && raw.length <= 3 && n > 0;
    final chips = showChips ? [n * 1000, n * 10000, n * 100000] : <int>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: controller,
          focusNode: focusNode,
          keyboardType: TextInputType.number,
          onChanged: (v) => setState(() => onValue(parse(v))),
          decoration: InputDecoration(
            labelText: label,
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            suffixText: 'đ',
          ),
        ),
        if (chips.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Wrap(
              spacing: 6,
              children: chips.map((v) => GestureDetector(
                onTap: () => setState(() {
                  controller.text = nf.format(v);
                  onValue(v.toDouble());
                }),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _purple.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text('${nf.format(v)}đ', style: const TextStyle(fontSize: 11, color: _purple)),
                ),
              )).toList(),
            ),
          ),
      ],
    );
  }

  Widget _field(IconData? icon, String hint, TextEditingController ctrl) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _border),
        ),
        child: Row(children: [
          if (icon != null) ...[
            const SizedBox(width: 12),
            Icon(icon, size: 18, color: Colors.grey[500]),
          ],
          Expanded(
            child: TextField(
              controller: ctrl,
              decoration: InputDecoration(
                hintText: hint,
                hintStyle: TextStyle(fontSize: 14, color: Colors.grey[400]),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(horizontal: icon != null ? 8 : 12, vertical: 12),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _buildProductLine(int index) {
    final line = _lines[index];
    final provider = context.read<WineDataProvider>();

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(8)),
      child: Column(children: [
        // Product name/search
        Row(children: [
          CircleAvatar(radius: 12, backgroundColor: _purple.withOpacity(0.2), child: Text('${index + 1}', style: TextStyle(fontSize: 11, color: _purple))),
          const SizedBox(width: 8),
          Expanded(child: GestureDetector(
            onTap: () async {
              final selected = await _selectProduct(provider.products);
              if (selected != null) {
                setState(() {
                  line.name = selected['short_name'] as String? ?? selected['product_name'] as String? ?? '';
                  line.sku = selected['sku'] as String? ?? '';
                });
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(6)),
              child: Text(line.name.isNotEmpty ? line.name : 'Tìm sản phẩm / SKU...', style: TextStyle(fontSize: 13, color: line.name.isNotEmpty ? _navy : Colors.grey[400])),
            ),
          )),
          if (_lines.length > 1)
            IconButton(icon: const Icon(Icons.close, size: 16, color: Colors.red), onPressed: () => setState(() => _lines.removeAt(index))),
        ]),
        const SizedBox(height: 6),
        // Qty + Price
        Row(children: [
          SizedBox(width: 60, child: TextField(
            keyboardType: TextInputType.number,
            controller: line.qtyCtrl,
            onChanged: (v) => setState(() => line.qty = int.tryParse(v) ?? 0),
            decoration: const InputDecoration(labelText: 'SL', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6)),
          )),
          const SizedBox(width: 8),
          Expanded(child: _moneySuggestField(
            label: 'Đơn giá',
            controller: line.priceCtrl,
            focusNode: line.priceFocus,
            onValue: (val) => setState(() => line.price = val),
          )),
          const SizedBox(width: 8),
          SizedBox(width: 80, child: _buildColorDropdown(line)),
        ]),
      ]),
    );
  }

  Future<Map<String, dynamic>?> _selectProduct(List<Map<String, dynamic>> products) async {
    return showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        String query = '';
        return StatefulBuilder(builder: (ctx, setS) {
          final filtered = query.isEmpty
              ? products
              : products.where((p) {
                  final q = query.toLowerCase();
                  return (p['sku'] as String? ?? '').toLowerCase().contains(q) ||
                      (p['product_name'] as String? ?? '').toLowerCase().contains(q) ||
                      (p['short_name'] as String? ?? '').toLowerCase().contains(q);
                }).toList();
          return DraggableScrollableSheet(
            initialChildSize: 0.6, maxChildSize: 0.9, minChildSize: 0.3,
            expand: false,
            builder: (_, scrollCtrl) => Column(children: [
              Padding(
                padding: const EdgeInsets.all(12),
                child: TextField(
                  onChanged: (v) => setS(() => query = v),
                  decoration: InputDecoration(hintText: 'Tìm sản phẩm...', prefixIcon: const Icon(Icons.search), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                ),
              ),
              Expanded(child: ListView.builder(
                controller: scrollCtrl,
                itemCount: filtered.length,
                itemBuilder: (_, i) {
                  final p = filtered[i];
                  return ListTile(
                    title: Text(p['short_name'] as String? ?? p['product_name'] as String? ?? '', style: const TextStyle(fontSize: 13)),
                    subtitle: Text('SKU: ${p['sku'] ?? ''}', style: const TextStyle(fontSize: 11)),
                    onTap: () => Navigator.pop(ctx, p),
                  );
                },
              )),
            ]),
          );
        });
      },
    );
  }

  // ─── Color Dropdown ───────────────────────────────────────────────────────

  Widget _buildColorDropdown(_ProductLine line) {
    return GestureDetector(
      onTap: () => _showColorPicker(line),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          border: Border.all(color: _border),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                line.color.isNotEmpty ? line.color : 'Màu',
                style: TextStyle(fontSize: 12, color: line.color.isNotEmpty ? _navy : Colors.grey[400]),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Icon(Icons.arrow_drop_down, size: 16, color: Colors.grey[500]),
          ],
        ),
      ),
    );
  }

  void _showColorPicker(_ProductLine line) async {
    final colors = await WineColorService.instance.getColors();
    if (!mounted) return;

    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.5),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 8, 8),
                child: Row(
                  children: [
                    const Text('Chọn màu sắc', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.settings_outlined, size: 20, color: Color(0xFF6C2BD9)),
                      tooltip: 'Quản lý màu',
                      onPressed: () {
                        Navigator.pop(ctx);
                        _showColorManager();
                      },
                    ),
                  ],
                ),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    // Option: no color
                    ListTile(
                      dense: true,
                      title: Text('Không chọn', style: TextStyle(color: Colors.grey[500])),
                      trailing: line.color.isEmpty ? const Icon(Icons.check, color: Color(0xFF6C2BD9), size: 18) : null,
                      onTap: () => Navigator.pop(ctx, ''),
                    ),
                    ...colors.map((c) => ListTile(
                      dense: true,
                      title: Text(c),
                      trailing: line.color == c ? const Icon(Icons.check, color: Color(0xFF6C2BD9), size: 18) : null,
                      onTap: () => Navigator.pop(ctx, c),
                    )),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (result != null) {
      setState(() => line.color = result);
    }
  }

  void _showColorManager() async {
    var colors = await WineColorService.instance.getColors();
    if (!mounted) return;

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text('Quản lý màu sắc', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.add_circle_outline, color: Color(0xFF6C2BD9)),
                      onPressed: () async {
                        final name = await _inputDialog(ctx, 'Thêm màu', '');
                        if (name != null && name.trim().isNotEmpty) {
                          await WineColorService.instance.addColor(name.trim());
                          colors = await WineColorService.instance.getColors();
                          setDialogState(() {});
                        }
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 300),
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: colors.length,
                    itemBuilder: (_, i) => ListTile(
                      dense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                      title: Text(colors[i]),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: Icon(Icons.edit_outlined, size: 18, color: Colors.grey[600]),
                            onPressed: () async {
                              final newName = await _inputDialog(ctx, 'Đổi tên', colors[i]);
                              if (newName != null && newName.trim().isNotEmpty) {
                                await WineColorService.instance.renameColor(colors[i], newName.trim());
                                colors = await WineColorService.instance.getColors();
                                setDialogState(() {});
                              }
                            },
                          ),
                          IconButton(
                            icon: Icon(Icons.delete_outline, size: 18, color: Colors.red[400]),
                            onPressed: () async {
                              await WineColorService.instance.removeColor(colors[i]);
                              colors = await WineColorService.instance.getColors();
                              setDialogState(() {});
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: FilledButton.styleFrom(backgroundColor: const Color(0xFF6C2BD9)),
                    child: const Text('Đóng'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    setState(() {}); // Refresh dropdowns
  }

  Future<String?> _inputDialog(BuildContext context, String title, String initial) {
    final ctrl = TextEditingController(text: initial);
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(title, style: const TextStyle(fontSize: 16)),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: InputDecoration(
            hintText: 'Tên màu',
            filled: true,
            fillColor: const Color(0xFFF3EAFF).withOpacity(0.3),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF6C2BD9), width: 1.5)),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text('Hủy', style: TextStyle(color: Colors.grey[600]))),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text),
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF6C2BD9)),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }
}

class _ProductLine {
  String name;
  String sku;
  int qty;
  double price;
  String color;
  // Stable controllers + focus node so fields keep focus while typing.
  final TextEditingController priceCtrl;
  final TextEditingController qtyCtrl;
  final FocusNode priceFocus = FocusNode();

  _ProductLine({this.name = '', this.sku = '', this.qty = 1, this.price = 0, this.color = ''})
      : priceCtrl = TextEditingController(
          text: price > 0 ? NumberFormat('#,###', 'vi_VN').format(price.toInt()) : '',
        ),
        qtyCtrl = TextEditingController(text: qty > 0 ? '$qty' : '');
}
