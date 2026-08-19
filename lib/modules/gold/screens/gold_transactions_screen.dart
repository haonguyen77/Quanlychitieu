import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/gold_provider.dart';
import '../models/gold_models.dart';
import '../../../utils/formatters.dart';

class GoldTransactionsScreen extends StatefulWidget {
  const GoldTransactionsScreen({super.key});

  @override
  State<GoldTransactionsScreen> createState() => _GoldTransactionsScreenState();
}

class _GoldTransactionsScreenState extends State<GoldTransactionsScreen> {
  String _filterType = 'all'; // all, buy, sell

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<GoldProvider>().loadTransactions();
    });
  }

  List<GoldTransaction> _filteredTransactions(List<GoldTransaction> transactions) {
    if (_filterType == 'all') return transactions;
    return transactions.where((t) => t.type == _filterType).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Lịch sử mua/bán vàng'),
        backgroundColor: Colors.amber.shade700,
        foregroundColor: Colors.white,
      ),
      body: Consumer<GoldProvider>(
        builder: (context, provider, child) {
          final filteredList = _filteredTransactions(provider.transactions);

          return Column(
            children: [
              // Filter chips
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    FilterChip(
                      label: const Text('Tất cả'),
                      selected: _filterType == 'all',
                      visualDensity: VisualDensity.compact,
                      onSelected: (v) => setState(() => _filterType = 'all'),
                    ),
                    const SizedBox(width: 8),
                    FilterChip(
                      label: const Text('Mua'),
                      selected: _filterType == 'buy',
                      visualDensity: VisualDensity.compact,
                      selectedColor: Colors.green.shade100,
                      onSelected: (v) => setState(() => _filterType = 'buy'),
                    ),
                    const SizedBox(width: 8),
                    FilterChip(
                      label: const Text('Bán'),
                      selected: _filterType == 'sell',
                      visualDensity: VisualDensity.compact,
                      selectedColor: Colors.red.shade100,
                      onSelected: (v) => setState(() => _filterType = 'sell'),
                    ),
                  ],
                ),
              ),
              // Transaction list
              Expanded(
                child: provider.isLoading
                    ? const Center(child: CircularProgressIndicator())
                    : filteredList.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.receipt_long_outlined, size: 48, color: Theme.of(context).colorScheme.outline),
                                const SizedBox(height: 12),
                                Text(
                                  'Chưa có giao dịch vàng',
                                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: Theme.of(context).colorScheme.outline,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            itemCount: filteredList.length,
                            itemBuilder: (context, index) {
                              final t = filteredList[index];
                              return _buildTransactionCard(context, t, provider);
                            },
                          ),
              ),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddTransactionSheet(context),
        backgroundColor: Colors.amber.shade700,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildTransactionCard(BuildContext context, GoldTransaction t, GoldProvider provider) {
    final isBuy = t.type == 'buy';
    final color = isBuy ? Colors.green : Colors.red;

    return Dismissible(
      key: Key(t.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: Colors.red.shade100,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(Icons.delete, color: Colors.red.shade700),
      ),
      confirmDismiss: (direction) async {
        return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Xác nhận xóa'),
            content: const Text('Bạn có chắc muốn xóa giao dịch này?'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
              TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Xóa', style: TextStyle(color: Colors.red))),
            ],
          ),
        );
      },
      onDismissed: (_) => provider.deleteTransaction(t.id),
      child: Card(
        margin: const EdgeInsets.only(bottom: 8),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: color.withValues(alpha: 0.1),
                child: Icon(
                  isBuy ? Icons.arrow_downward : Icons.arrow_upward,
                  color: color,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: color.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            t.typeLabel,
                            style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          t.goldType,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${t.quantity} ${t.unitLabel} × ${Formatters.currency(t.pricePerUnit)}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.outline,
                      ),
                    ),
                    Text(
                      Formatters.relativeDate(t.date),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.outline,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                Formatters.currency(t.totalAmount),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showAddTransactionSheet(BuildContext context) {
    String type = 'buy';
    String goldType = 'SJC';
    String unit = 'chi';
    final quantityController = TextEditingController();
    final priceController = TextEditingController();
    final noteController = TextEditingController();
    DateTime selectedDate = DateTime.now();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return SingleChildScrollView(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Thêm giao dịch vàng',
                    style: Theme.of(ctx).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 16),

                  // Type selection
                  Text('Loại giao dịch', style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      FilterChip(
                        label: const Text('Mua'),
                        selected: type == 'buy',
                        visualDensity: VisualDensity.compact,
                        selectedColor: Colors.green.shade100,
                        onSelected: (_) => setSheetState(() => type = 'buy'),
                      ),
                      const SizedBox(width: 8),
                      FilterChip(
                        label: const Text('Bán'),
                        selected: type == 'sell',
                        visualDensity: VisualDensity.compact,
                        selectedColor: Colors.red.shade100,
                        onSelected: (_) => setSheetState(() => type = 'sell'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Gold type selection
                  Text('Loại vàng', style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: GoldProvider.defaultGoldTypes.map((gt) {
                      return FilterChip(
                        label: Text(gt),
                        selected: goldType == gt,
                        visualDensity: VisualDensity.compact,
                        selectedColor: Colors.amber.shade100,
                        onSelected: (_) => setSheetState(() => goldType = gt),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),

                  // Unit selection
                  Text('Đơn vị', style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      FilterChip(
                        label: const Text('Chỉ'),
                        selected: unit == 'chi',
                        visualDensity: VisualDensity.compact,
                        onSelected: (_) => setSheetState(() => unit = 'chi'),
                      ),
                      const SizedBox(width: 8),
                      FilterChip(
                        label: const Text('Lượng'),
                        selected: unit == 'luong',
                        visualDensity: VisualDensity.compact,
                        onSelected: (_) => setSheetState(() => unit = 'luong'),
                      ),
                      const SizedBox(width: 8),
                      FilterChip(
                        label: const Text('Gram'),
                        selected: unit == 'gram',
                        visualDensity: VisualDensity.compact,
                        onSelected: (_) => setSheetState(() => unit = 'gram'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Quantity
                  TextField(
                    controller: quantityController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      labelText: 'Số lượng',
                      hintText: 'VD: 1, 2, 0.5',
                      border: const OutlineInputBorder(),
                      suffixText: unit == 'chi' ? 'chỉ' : unit == 'luong' ? 'lượng' : 'gram',
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Price per unit
                  TextField(
                    controller: priceController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      labelText: 'Giá mỗi ${unit == 'chi' ? 'chỉ' : unit == 'luong' ? 'lượng' : 'gram'}',
                      hintText: 'VD: 7800000',
                      border: const OutlineInputBorder(),
                      suffixText: 'đ',
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Date
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.calendar_today),
                    title: Text('Ngày: ${Formatters.date(selectedDate)}'),
                    trailing: const Icon(Icons.edit_calendar),
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: ctx,
                        initialDate: selectedDate,
                        firstDate: DateTime(2020),
                        lastDate: DateTime.now().add(const Duration(days: 1)),
                      );
                      if (picked != null) {
                        setSheetState(() => selectedDate = picked);
                      }
                    },
                  ),
                  const SizedBox(height: 12),

                  // Note
                  TextField(
                    controller: noteController,
                    decoration: const InputDecoration(
                      labelText: 'Ghi chú (tùy chọn)',
                      border: OutlineInputBorder(),
                    ),
                    maxLines: 2,
                  ),
                  const SizedBox(height: 24),

                  // Save button
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () {
                        final qty = double.tryParse(quantityController.text) ?? 0;
                        final price = double.tryParse(priceController.text) ?? 0;

                        if (qty <= 0 || price <= 0) {
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            const SnackBar(content: Text('Vui lòng nhập số lượng và giá hợp lệ')),
                          );
                          return;
                        }

                        final now = DateTime.now();
                        final transaction = GoldTransaction(
                          id: '',
                          type: type,
                          goldType: goldType,
                          unit: unit,
                          quantity: qty,
                          pricePerUnit: price,
                          totalAmount: qty * price,
                          date: selectedDate,
                          note: noteController.text.isNotEmpty ? noteController.text : null,
                          createdAt: now,
                          updatedAt: now,
                        );

                        context.read<GoldProvider>().addTransaction(transaction);
                        Navigator.pop(ctx);
                      },
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.amber.shade700,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: const Text('Lưu giao dịch', style: TextStyle(fontSize: 16)),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
