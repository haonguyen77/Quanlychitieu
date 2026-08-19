import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/wine_data_provider.dart';
import '../products/wine_products_screen.dart';

/// Wine Inventory Screen — reads from records table (mod_ruou_inventory).
class WineInventoryScreen extends StatefulWidget {
  final VoidCallback? onBack;
  const WineInventoryScreen({super.key, this.onBack});

  @override
  State<WineInventoryScreen> createState() => _WineInventoryScreenState();
}

class _WineInventoryScreenState extends State<WineInventoryScreen> {
  static const _purple = Color(0xFF6C2BD9);
  static const _navy = Color(0xFF101B4D);
  static const _border = Color(0xFFE5E7EB);
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<WineDataProvider>().loadInventory());
  }

  @override
  void dispose() { _searchCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white, elevation: 0,
        leading: widget.onBack != null ? IconButton(icon: const Icon(Icons.arrow_back, color: _navy), onPressed: widget.onBack) : null,
        title: const Text('Kho rượu', style: TextStyle(color: _navy, fontWeight: FontWeight.bold)),
        actions: [
          TextButton.icon(
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const WineProductsScreen())),
            icon: const Icon(Icons.liquor, size: 18, color: _purple),
            label: const Text('Sản phẩm', style: TextStyle(fontSize: 12, color: _purple)),
          ),
        ],
      ),
      body: Consumer<WineDataProvider>(
        builder: (context, provider, _) {
          final query = _searchCtrl.text.toLowerCase();
          final items = query.isEmpty ? provider.inventory : provider.inventory.where((inv) {
            final sku = (inv['sku'] as String? ?? '').toLowerCase();
            final name = (inv['product_name'] as String? ?? '').toLowerCase();
            return sku.contains(query) || name.contains(query);
          }).toList();

          final totalStock = items.fold<int>(0, (s, inv) => s + (int.tryParse(inv['stock']?.toString() ?? '0') ?? 0));

          return Column(children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(children: [
                Expanded(child: TextField(
                  controller: _searchCtrl, onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(hintText: 'Tìm sản phẩm kho...', prefixIcon: const Icon(Icons.search, size: 20),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _border)),
                    isDense: true, contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
                )),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(color: _purple.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                  child: Text('Tổng: $totalStock', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: _purple)),
                ),
              ]),
            ),
            Expanded(
              child: items.isEmpty
                  ? const Center(child: Text('Kho trống'))
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final inv = items[i];
                        final stock = int.tryParse(inv['stock']?.toString() ?? '0') ?? 0;
                        final isLow = stock <= 4;
                        return ListTile(
                          leading: Container(
                            width: 36, height: 36,
                            decoration: BoxDecoration(color: isLow ? Colors.red.withOpacity(0.1) : _purple.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                            child: Center(child: Text('$stock', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: isLow ? Colors.red : _purple))),
                          ),
                          title: Text(inv['product_name'] as String? ?? inv['sku'] as String? ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                          subtitle: Text('SKU: ${inv['sku'] ?? ''} • ${inv['wine_type'] ?? ''} • ${inv['bottle_type'] ?? ''}', style: TextStyle(fontSize: 10, color: Colors.grey[600])),
                          trailing: IconButton(icon: const Icon(Icons.edit, size: 18, color: _purple), onPressed: () => _editInventory(inv)),
                        );
                      },
                    ),
            ),
          ]);
        },
      ),
    );
  }

  void _addInventory() async {
    final result = await _showForm(null);
    if (result != null) await context.read<WineDataProvider>().addInventory(result);
  }

  void _editInventory(Map<String, dynamic> inv) async {
    final result = await _showForm(inv);
    if (result != null) await context.read<WineDataProvider>().updateInventory(inv['id'] as String, result);
  }

  Future<Map<String, dynamic>?> _showForm(Map<String, dynamic>? existing) {
    final skuCtrl = TextEditingController(text: existing?['sku'] as String? ?? '');
    final nameCtrl = TextEditingController(text: existing?['product_name'] as String? ?? '');
    final stockCtrl = TextEditingController(text: (existing?['stock'] ?? '').toString());
    final colorCtrl = TextEditingController(text: existing?['color'] as String? ?? '');

    const purple = Color(0xFF6C2BD9);
    const purpleLight = Color(0xFFF3EAFF);
    const navy = Color(0xFF101B4D);

    return showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Text(
                  existing != null ? 'Sửa tồn kho' : 'Thêm tồn kho',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: navy),
                ),
                const SizedBox(height: 20),
                // SKU
                _styledField(controller: skuCtrl, label: 'SKU *', icon: Icons.qr_code_outlined),
                const SizedBox(height: 14),
                // Name
                _styledField(controller: nameCtrl, label: 'Tên sản phẩm *', icon: Icons.inventory_2_outlined),
                const SizedBox(height: 14),
                // Stock
                _styledField(controller: stockCtrl, label: 'Số lượng tồn *', icon: Icons.numbers_outlined, keyboardType: TextInputType.number),
                const SizedBox(height: 14),
                // Color
                _styledField(controller: colorCtrl, label: 'Màu', icon: Icons.palette_outlined),
                const SizedBox(height: 24),
                // Actions
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          side: BorderSide(color: Colors.grey[300]!),
                        ),
                        child: Text('Hủy', style: TextStyle(color: Colors.grey[600], fontWeight: FontWeight.w500)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () {
                          if (skuCtrl.text.trim().isEmpty) return;
                          Navigator.pop(ctx, {
                            'mod_ruou_inventory_sku': skuCtrl.text.trim(),
                            'mod_ruou_inventory_product_name': nameCtrl.text.trim(),
                            'mod_ruou_inventory_stock': int.tryParse(stockCtrl.text) ?? 0,
                            'mod_ruou_inventory_color': colorCtrl.text.trim(),
                            'mod_ruou_inventory_wine_type': '',
                            'mod_ruou_inventory_bottle_type': '',
                          });
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: purple,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('Lưu', style: TextStyle(fontWeight: FontWeight.w600)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _styledField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType? keyboardType,
  }) {
    const purple = Color(0xFF6C2BD9);
    const purpleLight = Color(0xFFF3EAFF);
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      style: const TextStyle(fontSize: 14),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(fontSize: 13, color: Colors.grey[600]),
        prefixIcon: Container(
          margin: const EdgeInsets.only(left: 12, right: 8),
          child: Icon(icon, size: 18, color: purple),
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 40, minHeight: 40),
        filled: true,
        fillColor: purpleLight.withOpacity(0.3),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: purple, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }
}
