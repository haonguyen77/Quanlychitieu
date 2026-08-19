import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../providers/transaction_provider.dart';
import '../../models/transaction.dart';
import '../../utils/formatters.dart';

/// Refund dialog - creates a reverse transaction linked to original
class RefundDialog extends StatefulWidget {
  final Transaction originalTransaction;
  const RefundDialog({super.key, required this.originalTransaction});

  @override
  State<RefundDialog> createState() => _RefundDialogState();
}

class _RefundDialogState extends State<RefundDialog> {
  final _amountController = TextEditingController();
  final _noteController = TextEditingController();
  bool _isFullRefund = true;

  @override
  void initState() {
    super.initState();
    _amountController.text = widget.originalTransaction.amount.toStringAsFixed(0);
    _noteController.text = 'Hoàn tiền: ${widget.originalTransaction.title}';
  }

  @override
  void dispose() {
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Hoàn tiền'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Original transaction info
        Card(color: Theme.of(context).colorScheme.surfaceContainerHighest, child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Giao dịch gốc:', style: Theme.of(context).textTheme.bodySmall),
            Text(widget.originalTransaction.title, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
            Text(Formatters.currency(widget.originalTransaction.amount), style: const TextStyle(color: Colors.red, fontWeight: FontWeight.w600)),
          ]),
        )),
        const SizedBox(height: 16),
        // Refund type
        Row(children: [
          Expanded(child: RadioListTile<bool>(
            title: const Text('Hoàn toàn bộ', style: TextStyle(fontSize: 14)),
            value: true, groupValue: _isFullRefund, dense: true, contentPadding: EdgeInsets.zero,
            onChanged: (v) { setState(() { _isFullRefund = true; _amountController.text = widget.originalTransaction.amount.toStringAsFixed(0); }); },
          )),
          Expanded(child: RadioListTile<bool>(
            title: const Text('Hoàn 1 phần', style: TextStyle(fontSize: 14)),
            value: false, groupValue: _isFullRefund, dense: true, contentPadding: EdgeInsets.zero,
            onChanged: (v) => setState(() => _isFullRefund = false),
          )),
        ]),
        const SizedBox(height: 8),
        TextField(
          controller: _amountController,
          keyboardType: TextInputType.number,
          enabled: !_isFullRefund,
          decoration: const InputDecoration(labelText: 'Số tiền hoàn', isDense: true, border: OutlineInputBorder(), suffixText: '₫'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _noteController,
          decoration: const InputDecoration(labelText: 'Ghi chú', isDense: true, border: OutlineInputBorder()),
        ),
      ])),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Hủy')),
        FilledButton(onPressed: _processRefund, child: const Text('Hoàn tiền')),
      ],
    );
  }

  Future<void> _processRefund() async {
    final amount = double.tryParse(_amountController.text.replaceAll(',', ''));
    if (amount == null || amount <= 0) return;

    final provider = context.read<TransactionProvider>();
    final uuid = const Uuid();
    final original = widget.originalTransaction;

    // Create a refund transaction (type = income to offset the expense)
    final refund = Transaction(
      id: uuid.v4(),
      type: 1, // income (hoàn tiền)
      amount: amount,
      title: 'Hoàn: ${original.title}',
      note: _noteController.text.trim().isEmpty ? null : _noteController.text.trim(),
      categoryId: original.categoryId,
      accountId: original.accountId,
      moduleId: original.moduleId,
      date: DateTime.now(),
      tags: 'hoàn tiền',
    );

    await provider.addTransaction(refund);

    if (mounted) {
      Navigator.pop(context, true);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Đã hoàn ${Formatters.currency(amount)}'),
        behavior: SnackBarBehavior.floating,
      ));
    }
  }
}
