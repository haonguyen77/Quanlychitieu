import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/wine_data_provider.dart';

/// Wine Products Screen — reads from records table (mod_ruou_products).
class WineProductsScreen extends StatefulWidget {
  final VoidCallback? onBack;
  const WineProductsScreen({super.key, this.onBack});

  @override
  State<WineProductsScreen> createState() => _WineProductsScreenState();
}

class _WineProductsScreenState extends State<WineProductsScreen> {
  static const _purple = Color(0xFF6C2BD9);
  static const _navy = Color(0xFF101B4D);
  static const _border = Color(0xFFE5E7EB);
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<WineDataProvider>().loadProducts());
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
        title: const Text('Sản phẩm', style: TextStyle(color: _navy, fontWeight: FontWeight.bold)),
      ),
      body: Consumer<WineDataProvider>(
        builder: (context, provider, _) {
          final query = _searchCtrl.text.toLowerCase();
          final products = query.isEmpty ? provider.products : provider.products.where((p) {
            final name = (p['product_name'] as String? ?? '').toLowerCase();
            final sku = (p['sku'] as String? ?? '').toLowerCase();
            final shortName = (p['short_name'] as String? ?? '').toLowerCase();
            return name.contains(query) || sku.contains(query) || shortName.contains(query);
          }).toList();

          return Column(children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                controller: _searchCtrl, onChanged: (_) => setState(() {}),
                decoration: InputDecoration(hintText: 'Tìm sản phẩm...', prefixIcon: const Icon(Icons.search, size: 20),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _border)),
                  isDense: true, contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
              ),
            ),
            Expanded(
              child: products.isEmpty
                  ? const Center(child: Text('Chưa có sản phẩm'))
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      itemCount: products.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final p = products[i];
                        return ListTile(
                          title: Text(p['short_name'] as String? ?? p['product_name'] as String? ?? '', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                          subtitle: Text('SKU: ${p['sku'] ?? ''} • ${p['volume_ml'] ?? ''}ml • ${p['wine_type'] ?? ''} • ${p['bottle_type'] ?? ''}', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                          trailing: IconButton(icon: const Icon(Icons.edit, size: 18, color: _purple), onPressed: () => _editProduct(p)),
                          onTap: () => _editProduct(p),
                        );
                      },
                    ),
            ),
          ]);
        },
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: _purple,
        onPressed: () => _addProduct(),
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  void _addProduct() async {
    final result = await _showProductForm(null);
    if (result != null) {
      await context.read<WineDataProvider>().addProduct(result);
    }
  }

  void _editProduct(Map<String, dynamic> product) async {
    final result = await _showProductForm(product);
    if (result != null) {
      await context.read<WineDataProvider>().updateProduct(product['id'] as String, result);
    }
  }

  Future<Map<String, dynamic>?> _showProductForm(Map<String, dynamic>? existing) {
    final nameCtrl = TextEditingController(text: existing?['product_name'] as String? ?? '');
    final skuCtrl = TextEditingController(text: existing?['sku'] as String? ?? '');
    final shortCtrl = TextEditingController(text: existing?['short_name'] as String? ?? '');
    final volCtrl = TextEditingController(text: (existing?['volume_ml'] ?? '').toString());
    String? wineType = existing?['wine_type'] as String?;
    String? bottleType = existing?['bottle_type'] as String?;

    return showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setS) => AlertDialog(
        title: Text(existing != null ? 'Sửa sản phẩm' : 'Thêm sản phẩm'),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Tên sản phẩm *')),
          TextField(controller: skuCtrl, decoration: const InputDecoration(labelText: 'SKU')),
          TextField(controller: shortCtrl, decoration: const InputDecoration(labelText: 'Tên ngắn')),
          TextField(controller: volCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Dung tích (ml)')),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(value: wineType, decoration: const InputDecoration(labelText: 'Loại rượu'),
            items: ['gao', 'gao loai 2', 'nep', 'dauxanh', 'vangnep', 'dtht'].map((v) => DropdownMenuItem(value: v, child: Text(v))).toList(),
            onChanged: (v) => setS(() => wineType = v)),
          DropdownButtonFormField<String>(value: bottleType, decoration: const InputDecoration(labelText: 'Loại chai'),
            items: ['pet', 'su', 'thuytinh'].map((v) => DropdownMenuItem(value: v, child: Text(v))).toList(),
            onChanged: (v) => setS(() => bottleType = v)),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          FilledButton(onPressed: () {
            if (nameCtrl.text.trim().isEmpty) return;
            Navigator.pop(ctx, {
              'mod_ruou_products_product_name': nameCtrl.text.trim(),
              'mod_ruou_products_sku': skuCtrl.text.trim(),
              'mod_ruou_products_short_name': shortCtrl.text.trim(),
              'mod_ruou_products_volume_ml': int.tryParse(volCtrl.text) ?? 0,
              'mod_ruou_products_wine_type': wineType ?? '',
              'mod_ruou_products_bottle_type': bottleType ?? '',
              'mod_ruou_products_note': '',
            });
          }, child: const Text('Lưu')),
        ],
      )),
    );
  }
}
