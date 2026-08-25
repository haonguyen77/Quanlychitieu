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
    final volCtrl = TextEditingController(text: existing?['volume_ml'] != null && existing?['volume_ml'] != 0
        ? existing!['volume_ml'].toString() : '');
    String? wineType = existing?['wine_type'] as String?;
    String? bottleType = existing?['bottle_type'] as String?;

    // Grey rounded field with a leading icon (matches the mockup).
    Widget field({required TextEditingController c, required String hint, required IconData icon, TextInputType? kb, String? suffix}) {
      return Container(
        height: 52,
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: _border)),
        child: Row(children: [
          const SizedBox(width: 14),
          Icon(icon, size: 18, color: Colors.grey[500]),
          const SizedBox(width: 8),
          Expanded(child: TextField(
            controller: c,
            keyboardType: kb,
            style: const TextStyle(fontSize: 14, color: _navy),
            decoration: InputDecoration(
              hintText: hint, hintStyle: TextStyle(fontSize: 14, color: Colors.grey[400]),
              border: InputBorder.none, isDense: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 14),
            ),
          )),
          if (suffix != null) Padding(padding: const EdgeInsets.only(right: 14), child: Text(suffix, style: TextStyle(fontSize: 13, color: Colors.grey[500]))),
        ]),
      );
    }

    Widget dropdown({required String? value, required String hint, required IconData icon, required List<String> options, required ValueChanged<String?> onChanged}) {
      return Container(
        height: 52,
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: _border)),
        child: Row(children: [
          const SizedBox(width: 14),
          Icon(icon, size: 18, color: Colors.grey[500]),
          const SizedBox(width: 8),
          Expanded(child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              isExpanded: true,
              hint: Text(hint, style: TextStyle(fontSize: 14, color: Colors.grey[400])),
              items: options.map((v) => DropdownMenuItem(value: v, child: Text(v, style: const TextStyle(fontSize: 14)))).toList(),
              onChanged: onChanged,
            ),
          )),
          const SizedBox(width: 12),
        ]),
      );
    }

    return showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setS) => Dialog(
        insetPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 12, 8, 4),
            child: Row(children: [
              IconButton(icon: const Icon(Icons.arrow_back, color: _navy), onPressed: () => Navigator.pop(ctx)),
              Expanded(child: Text(existing != null ? 'Sửa sản phẩm' : 'Thêm sản phẩm',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _navy))),
              const SizedBox(width: 48),
            ]),
          ),
          Flexible(child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Column(children: [
              field(c: nameCtrl, hint: 'Tên sản phẩm *', icon: Icons.wine_bar_outlined),
              field(c: skuCtrl, hint: 'SKU *', icon: Icons.qr_code_outlined),
              field(c: shortCtrl, hint: 'Tên ngắn (tùy chọn)', icon: Icons.short_text),
              field(c: volCtrl, hint: 'Dung tích (ml)', icon: Icons.local_drink_outlined, kb: TextInputType.number, suffix: 'ml'),
              dropdown(value: wineType, hint: 'Loại rượu', icon: Icons.liquor_outlined,
                options: const ['gao', 'gao loai 2', 'nep', 'dauxanh', 'vangnep', 'dtht'],
                onChanged: (v) => setS(() => wineType = v)),
              dropdown(value: bottleType, hint: 'Loại chai', icon: Icons.wine_bar,
                options: const ['pet', 'su', 'thuytinh'],
                onChanged: (v) => setS(() => bottleType = v)),
            ]),
          )),
          // Buttons
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Row(children: [
              Expanded(child: OutlinedButton(
                onPressed: () => Navigator.pop(ctx),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(50),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  side: BorderSide(color: Colors.grey[300]!),
                ),
                child: Text('Hủy', style: TextStyle(color: Colors.grey[700], fontWeight: FontWeight.w500)),
              )),
              const SizedBox(width: 12),
              Expanded(child: FilledButton(
                onPressed: () {
                  if (nameCtrl.text.trim().isEmpty || skuCtrl.text.trim().isEmpty) return;
                  Navigator.pop(ctx, {
                    'mod_ruou_products_product_name': nameCtrl.text.trim(),
                    'mod_ruou_products_sku': skuCtrl.text.trim(),
                    'mod_ruou_products_short_name': shortCtrl.text.trim(),
                    'mod_ruou_products_volume_ml': int.tryParse(volCtrl.text) ?? 0,
                    'mod_ruou_products_wine_type': wineType ?? '',
                    'mod_ruou_products_bottle_type': bottleType ?? '',
                    'mod_ruou_products_note': '',
                  });
                },
                style: FilledButton.styleFrom(
                  backgroundColor: _purple,
                  minimumSize: const Size.fromHeight(50),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Lưu', style: TextStyle(fontWeight: FontWeight.w600)),
              )),
            ]),
          ),
        ]),
      )),
    );
  }
}
