import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/wine_data_provider.dart';
import 'customers/wine_customers_screen.dart';
import 'inventory/wine_inventory_screen.dart';
import 'reports/wine_reports_screen.dart';
import 'sales/wine_order_list_screen.dart';
import 'sales/wine_order_form_screen.dart';

class WineHomeScreen extends StatefulWidget {
  const WineHomeScreen({super.key});

  @override
  State<WineHomeScreen> createState() => _WineHomeScreenState();
}

class _WineHomeScreenState extends State<WineHomeScreen> {
  static const _purple = Color(0xFF6C2BD9);
  int _currentIndex = 1; // Default: Đơn hàng

  void _switchTab(int index) {
    setState(() => _currentIndex = index);
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<WineDataProvider>().loadAll();
    });
  }

  void _onTabTapped(int index) {
    if (index == 2) {
      _openAddScreen();
      return;
    }
    setState(() => _currentIndex = index);
  }

  void _openAddScreen() {
    switch (_currentIndex) {
      case 0: // Báo cáo - no add
        break;
      case 1: // Đơn hàng
        Navigator.push(context, MaterialPageRoute(builder: (_) => const WineOrderFormScreen()));
        break;
      case 3: // Khách hàng
        _addCustomer();
        break;
      case 4: // Kho
        _addInventory();
        break;
    }
  }

  void _addCustomer() async {
    // Trigger the add form in customer screen via a global key or direct dialog
    final result = await _showCustomerForm();
    if (result != null) {
      await context.read<WineDataProvider>().addCustomer(result);
    }
  }

  void _addInventory() async {
    final result = await _showInventoryForm();
    if (result != null) {
      await context.read<WineDataProvider>().addInventory(result);
    }
  }

  Future<Map<String, dynamic>?> _showCustomerForm() {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final addrCtrl = TextEditingController();
    final districtCtrl = TextEditingController();
    final cityCtrl = TextEditingController();
    final noteCtrl = TextEditingController();

    // Existing customers → source of ward/city suggestions.
    final customers = context.read<WineDataProvider>().customers;
    List<String> distinct(String key) {
      final set = <String>{};
      for (final c in customers) {
        final v = ((c[key] as String?) ?? '').trim();
        if (v.isNotEmpty) set.add(v);
      }
      return set.toList();
    }

    Widget autocompleteField({required TextEditingController controller, required String label, required IconData icon, required List<String> suggestions}) {
      InputDecoration deco() => InputDecoration(
            labelText: label,
            labelStyle: TextStyle(fontSize: 13, color: Colors.grey[600]),
            prefixIcon: Container(margin: const EdgeInsets.only(left: 12, right: 8), child: Icon(icon, size: 18, color: _purple)),
            prefixIconConstraints: const BoxConstraints(minWidth: 40, minHeight: 40),
            filled: true,
            fillColor: _purple.withOpacity(0.05),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: _purple, width: 1.5)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          );
      return RawAutocomplete<String>(
        textEditingController: controller,
        focusNode: FocusNode(),
        optionsBuilder: (value) {
          final q = value.text.trim().toLowerCase();
          if (q.isEmpty) return const Iterable<String>.empty();
          return suggestions.where((s) => s.toLowerCase().contains(q)).take(6);
        },
        onSelected: (v) => controller.text = v,
        fieldViewBuilder: (context, textCtrl, focusNode, onSubmit) => TextField(
          controller: textCtrl, focusNode: focusNode, style: const TextStyle(fontSize: 14), decoration: deco()),
        optionsViewBuilder: (context, onSelected, options) => Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 4,
            borderRadius: BorderRadius.circular(8),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 200, maxWidth: 200),
              child: ListView.builder(
                padding: EdgeInsets.zero, shrinkWrap: true, itemCount: options.length,
                itemBuilder: (context, i) {
                  final opt = options.elementAt(i);
                  return ListTile(dense: true, title: Text(opt, style: const TextStyle(fontSize: 14)), onTap: () => onSelected(opt));
                },
              ),
            ),
          ),
        ),
      );
    }

    Widget styledField({required TextEditingController controller, required String label, required IconData icon, TextInputType? keyboardType}) {
      return TextField(
        controller: controller,
        keyboardType: keyboardType,
        style: const TextStyle(fontSize: 14),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: TextStyle(fontSize: 13, color: Colors.grey[600]),
          prefixIcon: Container(margin: const EdgeInsets.only(left: 12, right: 8), child: Icon(icon, size: 18, color: _purple)),
          prefixIconConstraints: const BoxConstraints(minWidth: 40, minHeight: 40),
          filled: true,
          fillColor: _purple.withOpacity(0.05),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: _purple, width: 1.5)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
      );
    }

    return showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Thêm khách hàng', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Color(0xFF101B4D))),
              const SizedBox(height: 20),
              styledField(controller: nameCtrl, label: 'Họ tên *', icon: Icons.person_outline),
              const SizedBox(height: 12),
              styledField(controller: phoneCtrl, label: 'SĐT', icon: Icons.phone_outlined, keyboardType: TextInputType.phone),
              const SizedBox(height: 12),
              styledField(controller: addrCtrl, label: 'Địa chỉ', icon: Icons.location_on_outlined),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: autocompleteField(controller: districtCtrl, label: 'Phường/Xã', icon: Icons.map_outlined, suggestions: distinct('district'))),
                const SizedBox(width: 10),
                Expanded(child: autocompleteField(controller: cityCtrl, label: 'Thành phố', icon: Icons.location_city_outlined, suggestions: distinct('city'))),
              ]),
              const SizedBox(height: 12),
              styledField(controller: noteCtrl, label: 'Ghi chú', icon: Icons.notes_outlined),
              const SizedBox(height: 24),
              Row(children: [
                Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(ctx), style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), side: BorderSide(color: Colors.grey[300]!)), child: Text('Hủy', style: TextStyle(color: Colors.grey[600])))),
                const SizedBox(width: 12),
                Expanded(child: FilledButton(onPressed: () {
                  if (nameCtrl.text.trim().isEmpty) return;
                  Navigator.pop(ctx, {
                    'mod_ruou_customers_full_name': nameCtrl.text.trim(),
                    'mod_ruou_customers_phone': phoneCtrl.text.trim(),
                    'mod_ruou_customers_address': addrCtrl.text.trim(),
                    'mod_ruou_customers_district': districtCtrl.text.trim(),
                    'mod_ruou_customers_city': cityCtrl.text.trim(),
                    'mod_ruou_customers_total_orders': 0,
                    'mod_ruou_customers_last_order_date': '',
                    'mod_ruou_customers_note': noteCtrl.text.trim(),
                  });
                }, style: FilledButton.styleFrom(backgroundColor: _purple, padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))), child: const Text('Lưu', style: TextStyle(fontWeight: FontWeight.w600)))),
              ]),
            ]),
          ),
        ),
      ),
    );
  }

  Future<Map<String, dynamic>?> _showInventoryForm() {
    final skuCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final stockCtrl = TextEditingController();
    final colorCtrl = TextEditingController();

    // Products → source of SKU suggestions (auto-fill product name on select).
    final products = context.read<WineDataProvider>().products;

    Widget skuAutocomplete() {
      InputDecoration deco() => InputDecoration(
            labelText: 'SKU *',
            labelStyle: TextStyle(fontSize: 13, color: Colors.grey[600]),
            prefixIcon: Container(margin: const EdgeInsets.only(left: 12, right: 8), child: const Icon(Icons.qr_code_outlined, size: 18, color: _purple)),
            prefixIconConstraints: const BoxConstraints(minWidth: 40, minHeight: 40),
            filled: true,
            fillColor: _purple.withOpacity(0.05),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: _purple, width: 1.5)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          );
      return RawAutocomplete<Map<String, dynamic>>(
        textEditingController: skuCtrl,
        focusNode: FocusNode(),
        displayStringForOption: (p) => (p['sku'] as String?) ?? '',
        optionsBuilder: (value) {
          final q = value.text.trim().toLowerCase();
          if (q.isEmpty) return const Iterable<Map<String, dynamic>>.empty();
          return products.where((p) {
            final sku = ((p['sku'] as String?) ?? '').toLowerCase();
            final name = ((p['product_name'] as String?) ?? (p['short_name'] as String?) ?? '').toLowerCase();
            return sku.contains(q) || name.contains(q);
          }).take(8);
        },
        onSelected: (p) {
          skuCtrl.text = (p['sku'] as String?) ?? '';
          nameCtrl.text = (p['product_name'] as String?) ?? (p['short_name'] as String?) ?? '';
        },
        fieldViewBuilder: (context, textCtrl, focusNode, onSubmit) => TextField(
          controller: textCtrl, focusNode: focusNode, style: const TextStyle(fontSize: 14), decoration: deco()),
        optionsViewBuilder: (context, onSelected, options) => Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 4,
            borderRadius: BorderRadius.circular(8),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 220, maxWidth: 280),
              child: ListView.builder(
                padding: EdgeInsets.zero, shrinkWrap: true, itemCount: options.length,
                itemBuilder: (context, i) {
                  final p = options.elementAt(i);
                  final sku = (p['sku'] as String?) ?? '';
                  final name = (p['product_name'] as String?) ?? (p['short_name'] as String?) ?? '';
                  return ListTile(
                    dense: true,
                    title: Text('$sku - $name', style: const TextStyle(fontSize: 13)),
                    onTap: () => onSelected(p),
                  );
                },
              ),
            ),
          ),
        ),
      );
    }

    Widget styledField({required TextEditingController controller, required String label, required IconData icon, TextInputType? keyboardType}) {
      return TextField(
        controller: controller,
        keyboardType: keyboardType,
        style: const TextStyle(fontSize: 14),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: TextStyle(fontSize: 13, color: Colors.grey[600]),
          prefixIcon: Container(margin: const EdgeInsets.only(left: 12, right: 8), child: Icon(icon, size: 18, color: _purple)),
          prefixIconConstraints: const BoxConstraints(minWidth: 40, minHeight: 40),
          filled: true,
          fillColor: _purple.withOpacity(0.05),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: _purple, width: 1.5)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
      );
    }

    return showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Thêm tồn kho', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Color(0xFF101B4D))),
              const SizedBox(height: 20),
              skuAutocomplete(),
              const SizedBox(height: 14),
              styledField(controller: nameCtrl, label: 'Tên sản phẩm *', icon: Icons.inventory_2_outlined),
              const SizedBox(height: 14),
              styledField(controller: stockCtrl, label: 'Số lượng tồn *', icon: Icons.numbers_outlined, keyboardType: TextInputType.number),
              const SizedBox(height: 14),
              styledField(controller: colorCtrl, label: 'Màu', icon: Icons.palette_outlined),
              const SizedBox(height: 24),
              Row(children: [
                Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(ctx), style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), side: BorderSide(color: Colors.grey[300]!)), child: Text('Hủy', style: TextStyle(color: Colors.grey[600])))),
                const SizedBox(width: 12),
                Expanded(child: FilledButton(onPressed: () {
                  if (skuCtrl.text.trim().isEmpty) return;
                  Navigator.pop(ctx, {
                    'mod_ruou_inventory_sku': skuCtrl.text.trim(),
                    'mod_ruou_inventory_product_name': nameCtrl.text.trim(),
                    'mod_ruou_inventory_stock': int.tryParse(stockCtrl.text) ?? 0,
                    'mod_ruou_inventory_color': colorCtrl.text.trim(),
                    'mod_ruou_inventory_wine_type': '',
                    'mod_ruou_inventory_bottle_type': '',
                  });
                }, style: FilledButton.styleFrom(backgroundColor: _purple, padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))), child: const Text('Lưu', style: TextStyle(fontWeight: FontWeight.w600)))),
              ]),
            ]),
          ),
        ),
      ),
    );
  }

  /// Map bottom nav index to body widget index (skip index 2 = add button)
  int get _bodyIndex {
    if (_currentIndex <= 1) return _currentIndex;
    if (_currentIndex >= 3) return _currentIndex - 1;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _bodyIndex,
        children: [
          const WineReportsScreen(),       // nav 0 → body 0
          WineOrderListScreen(onBack: () => Navigator.of(context).pop()), // nav 1 → body 1
          WineCustomersScreen(onBack: () => _switchTab(1)),  // nav 3 → body 2
          WineInventoryScreen(onBack: () => _switchTab(1)),  // nav 4 → body 3
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: _onTabTapped,
        type: BottomNavigationBarType.fixed,
        selectedItemColor: _purple,
        unselectedItemColor: Colors.grey,
        selectedFontSize: 10,
        unselectedFontSize: 10,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.bar_chart), label: 'Báo cáo'),
          BottomNavigationBarItem(icon: Icon(Icons.receipt_long), label: 'Đơn hàng'),
          BottomNavigationBarItem(icon: Icon(Icons.add_circle, size: 32), label: ''),
          BottomNavigationBarItem(icon: Icon(Icons.people), label: 'Khách hàng'),
          BottomNavigationBarItem(icon: Icon(Icons.inventory_2), label: 'Kho'),
        ],
      ),
    );
  }
}
