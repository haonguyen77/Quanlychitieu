import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/transaction_provider.dart';
import '../../models/transaction.dart';
import '../../utils/formatters.dart';
import 'add_transaction_screen.dart';
import 'search_screen.dart';

class TransactionListScreen extends StatefulWidget {
  const TransactionListScreen({super.key});

  @override
  State<TransactionListScreen> createState() => _TransactionListScreenState();
}

class _TransactionListScreenState extends State<TransactionListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<TransactionProvider>().loadTransactions();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Giao dịch'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const SearchScreen()));
            },
          ),
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () {
              // TODO: Show filter bottom sheet
            },
          ),
        ],
      ),
      body: Consumer<TransactionProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.transactions.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.receipt_long_outlined,
                    size: 64,
                    color: Theme.of(context).colorScheme.outline,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Chưa có giao dịch',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: Theme.of(context).colorScheme.outline,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Nhấn + để thêm giao dịch mới',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.outline,
                        ),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.only(bottom: 80),
            itemCount: provider.transactions.length,
            itemBuilder: (context, index) {
              final transaction = provider.transactions[index];
              return _TransactionTile(transaction: transaction);
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => const AddTransactionScreen(),
            ),
          );
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _TransactionTile extends StatelessWidget {
  final Transaction transaction;

  const _TransactionTile({required this.transaction});

  @override
  Widget build(BuildContext context) {
    final isExpense = transaction.isExpense;
    final amountColor = isExpense
        ? Theme.of(context).colorScheme.error
        : Colors.green;

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
        child: Icon(
          isExpense ? Icons.arrow_upward : Icons.arrow_downward,
          color: amountColor,
          size: 20,
        ),
      ),
      title: Text(
        transaction.title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Text(
        '${transaction.categoryName ?? ''} • ${Formatters.relativeDate(transaction.date)}',
        style: Theme.of(context).textTheme.bodySmall,
      ),
      trailing: Text(
        '${isExpense ? '-' : '+'}${Formatters.currency(transaction.amount)}',
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: amountColor,
              fontWeight: FontWeight.w600,
            ),
      ),
      onTap: () {
        // TODO: Navigate to transaction detail
      },
    );
  }
}
