import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/transaction_provider.dart';
import '../../models/transaction.dart';
import '../../utils/formatters.dart';

class TrashScreen extends StatefulWidget {
  const TrashScreen({super.key});

  @override
  State<TrashScreen> createState() => _TrashScreenState();
}

class _TrashScreenState extends State<TrashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<TransactionProvider>().loadDeletedTransactions();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Thùng rác'),
        actions: [
          Consumer<TransactionProvider>(builder: (_, p, __) {
            if (p.deletedTransactions.isEmpty) return const SizedBox.shrink();
            return IconButton(
              icon: const Icon(Icons.delete_forever),
              tooltip: 'Xóa tất cả vĩnh viễn',
              onPressed: () => _confirmDeleteAll(p),
            );
          }),
        ],
      ),
      body: Consumer<TransactionProvider>(
        builder: (context, provider, _) {
          if (provider.deletedTransactions.isEmpty) {
            return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.delete_outline, size: 64, color: Theme.of(context).colorScheme.outline),
              const SizedBox(height: 16),
              Text('Thùng rác trống', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.outline)),
              const SizedBox(height: 8),
              Text('Giao dịch đã xóa sẽ hiển thị ở đây', style: Theme.of(context).textTheme.bodySmall),
            ]));
          }
          return ListView.builder(
            padding: const EdgeInsets.all(8),
            itemCount: provider.deletedTransactions.length,
            itemBuilder: (ctx, i) => _buildItem(provider.deletedTransactions[i], provider),
          );
        },
      ),
    );
  }

  Widget _buildItem(Transaction t, TransactionProvider provider) {
    final daysAgo = t.deletedAt != null ? DateTime.now().difference(t.deletedAt!).inDays : 0;
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 3, horizontal: 4),
      child: ListTile(
        dense: true,
        leading: CircleAvatar(
          radius: 16,
          backgroundColor: Colors.grey.withValues(alpha: 0.1),
          child: Icon(t.isExpense ? Icons.arrow_upward : Icons.arrow_downward, size: 16, color: Colors.grey),
        ),
        title: Text(t.title, maxLines: 1, overflow: TextOverflow.ellipsis,
            style: const TextStyle(decoration: TextDecoration.lineThrough)),
        subtitle: Text('${Formatters.date(t.date)} • Đã xóa $daysAgo ngày trước',
            style: Theme.of(context).textTheme.bodySmall),
        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
          IconButton(
            icon: const Icon(Icons.restore, size: 20, color: Colors.green),
            tooltip: 'Khôi phục',
            onPressed: () async {
              await provider.restoreTransaction(t.id);
              if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Đã khôi phục'), behavior: SnackBarBehavior.floating));
            },
          ),
          IconButton(
            icon: const Icon(Icons.delete_forever, size: 20, color: Colors.red),
            tooltip: 'Xóa vĩnh viễn',
            onPressed: () => _confirmDelete(t.id, provider),
          ),
        ]),
      ),
    );
  }

  void _confirmDelete(String id, TransactionProvider provider) async {
    final confirm = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Xóa vĩnh viễn'),
      content: const Text('Giao dịch sẽ bị xóa hoàn toàn và không thể khôi phục.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('Xóa')),
      ],
    ));
    if (confirm == true) await provider.permanentDeleteTransaction(id);
  }

  void _confirmDeleteAll(TransactionProvider provider) async {
    final confirm = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Xóa tất cả vĩnh viễn'),
      content: Text('Sẽ xóa ${provider.deletedTransactions.length} giao dịch. Không thể khôi phục!'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('Xóa tất cả')),
      ],
    ));
    if (confirm == true) {
      for (final t in List.from(provider.deletedTransactions)) {
        await provider.permanentDeleteTransaction(t.id);
      }
    }
  }
}
