import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/wine_product_provider.dart';
import '../../providers/wine_stock_provider.dart';
import '../../models/wine_product.dart';
import 'add_wine_product_screen.dart';

class WineProductDetailScreen extends StatefulWidget {
  final String productId;
  const WineProductDetailScreen({super.key, required this.productId});

  @override
  State<WineProductDetailScreen> createState() => _WineProductDetailScreenState();
}

class _WineProductDetailScreenState extends State<WineProductDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<WineProductProvider>().selectProduct(widget.productId);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<WineProductProvider>(
      builder: (context, provider, child) {
        final product = provider.selectedProduct;
        if (product == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const Center(child: CircularProgressIndicator()),
          );
        }

        return Scaffold(
          appBar: AppBar(
            title: Text(product.name),
            actions: [
              IconButton(
                icon: const Icon(Icons.edit_outlined),
                onPressed: () async {
                  await Navigator.push(context, MaterialPageRoute(
                    builder: (_) => AddWineProductScreen(editProduct: product),
                  ));
                  if (mounted) {
                    provider.selectProduct(widget.productId);
                  }
                },
              ),
              PopupMenuButton<String>(
                onSelected: (v) {
                  if (v == 'delete') _confirmDelete(context, product);
                },
                itemBuilder: (_) => [
                  const PopupMenuItem(value: 'delete', child: Text('Xóa sản phẩm')),
                ],
              ),
            ],
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Product info card
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            CircleAvatar(
                              radius: 24,
                              backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                              child: Icon(Icons.liquor, color: Theme.of(context).colorScheme.onPrimaryContainer),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(product.name, style: Theme.of(context).textTheme.titleLarge),
                                  Text('SKU: ${product.sku}', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.outline)),
                                ],
                              ),
                            ),
                          ],
                        ),
                        if (product.note != null && product.note!.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text(product.note!, style: Theme.of(context).textTheme.bodyMedium),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Variants with stock
                Text('Biến thể & Tồn kho', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                if (product.variants == null || product.variants!.isEmpty)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Center(
                        child: Text('Chưa có biến thể', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.outline)),
                      ),
                    ),
                  )
                else
                  for (final variant in product.variants!) Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: CircleAvatar(
                        radius: 18,
                        backgroundColor: variant.isLowStock
                            ? Colors.red.withValues(alpha: 0.1)
                            : Colors.green.withValues(alpha: 0.1),
                        child: Icon(Icons.circle, size: 14,
                            color: variant.isLowStock ? Colors.red : Colors.green),
                      ),
                      title: Text(variant.variantName ?? 'N/A'),
                      subtitle: variant.minStock > 0
                          ? Text('Cảnh báo khi ≤ ${variant.minStock} chai')
                          : null,
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('${variant.currentStock ?? 0}', style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: variant.isLowStock ? Colors.red : null,
                          )),
                          Text('chai', style: Theme.of(context).textTheme.bodySmall),
                        ],
                      ),
                      onTap: () => _showVariantSettings(context, variant),
                    ),
                  ),

                const SizedBox(height: 16),

                // Custom fields
                if (product.customFields != null && product.customFields!.isNotEmpty) ...[
                  Text('Thông tin bổ sung', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: product.customFields!.entries.map((e) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            children: [
                              Text(e.key, style: Theme.of(context).textTheme.bodySmall),
                              const Spacer(),
                              Text(e.value, style: Theme.of(context).textTheme.bodyMedium),
                            ],
                          ),
                        )).toList(),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  void _showVariantSettings(BuildContext context, WineProductVariant variant) {
    final controller = TextEditingController(text: variant.minStock.toString());
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Cài đặt: ${variant.variantName}'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'Mức tồn tối thiểu (chai)',
            hintText: '0 = không cảnh báo',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          FilledButton(
            onPressed: () async {
              final minStock = int.tryParse(controller.text) ?? 0;
              await context.read<WineProductProvider>().updateVariant(
                  variant.copyWith(minStock: minStock));
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('Lưu'),
          ),
        ],
      ),
    );
  }

  void _confirmDelete(BuildContext context, WineProduct product) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa sản phẩm'),
        content: Text('Bạn có chắc muốn xóa "${product.name}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          FilledButton(
            onPressed: () {
              context.read<WineProductProvider>().deleteProduct(product.id);
              Navigator.pop(ctx);
              Navigator.pop(context);
            },
            style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
  }
}
