import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/wine_data_provider.dart';
import '../../services/wine_color_service.dart';
import '../../../../utils/formatters.dart';

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
  final _shipFeeCtrl = TextEditingController(text: '0');
  final _note1Ctrl = TextEditingController();
  final _note2Ctrl = TextEditingController();

  DateTime _date = DateTime.now();
  List<_ProductLine> _lines = [_ProductLine()];

  bool get _isEditing => widget.editOrderId != null;
  Map<String, dynamic>? _editOrder;

  @override
  void initState() {
    super.initState();
    WineColorService.instance.getColors(); // Pre-load colors
    if (_isEditing) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadOrder());
    }
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
      _shipFeeCtrl.text = shipFee != null && shipFee != 0 ? shipFee.toString() : '0';
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
    });
  }

  @override
  void dispose() {
    _nameCtrl.dispose(); _phoneCtrl.dispose(); _addressCtrl.dispose();
    _wardCtrl.dispose(); _cityCtrl.dispose(); _shipFeeCtrl.dispose();
    _note1Ctrl.dispose(); _note2Ctrl.dispose();
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
        leading: IconButton(icon: const Icon(Icons.close, color: _navy), onPressed: () => Navigator.pop(context)),
        title: Text(_isEditing ? 'Sửa đơn hàng' : 'Tạo đơn hàng mới', style: const TextStyle(color: _navy, fontWeight: FontWeight.bold, fontSize: 16)),
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
          // Customer info
          _field(Icons.person, 'Tên khách hàng...', _nameCtrl),
          _field(Icons.phone, 'Số điện thoại...', _phoneCtrl),
          _field(Icons.location_on, 'Nhập địa chỉ...', _addressCtrl),
          Row(children: [
            Expanded(child: _field(null, 'Phường/Xã...', _wardCtrl)),
            const SizedBox(width: 8),
            Expanded(child: _field(null, 'Thành phố...', _cityCtrl)),
          ]),
          const SizedBox(height: 16),
          // Products
          Row(children: [
            const Text('Sản phẩm', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _navy)),
            const Spacer(),
            TextButton.icon(
              onPressed: () => setState(() => _lines.add(_ProductLine())),
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
            SizedBox(width: 100, child: TextField(
              controller: _shipFeeCtrl, keyboardType: TextInputType.number,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(suffixText: 'đ', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6)),
              textAlign: TextAlign.right,
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
            Expanded(flex: 2, child: FilledButton.icon(
              onPressed: _save,
              icon: const Icon(Icons.save, size: 18),
              label: const Text('Lưu đơn'),
              style: FilledButton.styleFrom(backgroundColor: _purple, minimumSize: const Size.fromHeight(48)),
            )),
          ]),
        ]),
      ),
    );
  }

  Widget _field(IconData? icon, String hint, TextEditingController ctrl) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: ctrl,
        decoration: InputDecoration(
          prefixIcon: icon != null ? Icon(icon, size: 20, color: Colors.grey[500]) : null,
          hintText: hint,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _border)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _border)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        ),
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
            controller: TextEditingController(text: line.qty > 0 ? '${line.qty}' : ''),
            onChanged: (v) => setState(() => line.qty = int.tryParse(v) ?? 0),
            decoration: const InputDecoration(labelText: 'SL', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6)),
          )),
          const SizedBox(width: 8),
          Expanded(child: TextField(
            keyboardType: TextInputType.number,
            controller: TextEditingController(text: line.price > 0 ? '${line.price.toInt()}' : ''),
            onChanged: (v) => setState(() => line.price = double.tryParse(v.replaceAll('.', '').replaceAll(',', '')) ?? 0),
            decoration: const InputDecoration(labelText: 'Đơn giá', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6), suffixText: 'đ'),
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
    final colors = WineColorService.instance.getColorsSync();
    final currentValue = line.color.isNotEmpty && colors.contains(line.color) ? line.color : null;

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

  _ProductLine({this.name = '', this.sku = '', this.qty = 1, this.price = 0, this.color = ''});
}
