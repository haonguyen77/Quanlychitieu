import 'package:flutter/material.dart' hide Category;
import 'package:uuid/uuid.dart';
import '../../database/database_helper.dart';
import '../../utils/formatters.dart';

class RecurringScreen extends StatefulWidget {
  const RecurringScreen({super.key});

  @override
  State<RecurringScreen> createState() => _RecurringScreenState();
}

class _RecurringScreenState extends State<RecurringScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final db = await DatabaseHelper.instance.database;
    final results = await db.rawQuery('''
      SELECT r.*, c.name as category_name, a.name as account_name, m.name as module_name
      FROM recurring_transactions r
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN accounts a ON r.account_id = a.id
      LEFT JOIN modules m ON r.module_id = m.id
      WHERE r.is_active = 1
      ORDER BY r.next_date ASC
    ''');
    setState(() { _items = results; _isLoading = false; });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Giao dịch định kỳ')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _items.isEmpty
              ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.repeat, size: 64, color: Theme.of(context).colorScheme.outline),
                  const SizedBox(height: 16),
                  Text('Chưa có giao dịch định kỳ', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.outline)),
                  const SizedBox(height: 8),
                  Text('Ví dụ: tiền lương, tiền điện, internet...', style: Theme.of(context).textTheme.bodySmall),
                ]))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(8),
                    itemCount: _items.length,
                    itemBuilder: (ctx, i) => _buildItem(_items[i]),
                  ),
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddDialog,
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildItem(Map<String, dynamic> item) {
    final isExpense = (item['type'] as int?) == 0;
    final freq = _freqLabel(item['frequency'] as String? ?? 'monthly');
    final nextDate = item['next_date'] != null ? DateTime.tryParse(item['next_date'] as String) : null;

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
      child: ListTile(
        leading: CircleAvatar(
          radius: 18,
          backgroundColor: isExpense ? Colors.red.withValues(alpha: 0.1) : Colors.green.withValues(alpha: 0.1),
          child: Icon(Icons.repeat, size: 18, color: isExpense ? Colors.red : Colors.green),
        ),
        title: Text(item['title'] as String? ?? '', maxLines: 1),
        subtitle: Text('$freq • ${item['category_name'] ?? ''} • Kế tiếp: ${nextDate != null ? Formatters.date(nextDate) : "?"}',
            style: Theme.of(context).textTheme.bodySmall),
        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(Formatters.currency((item['amount'] as num?)?.toDouble() ?? 0),
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: isExpense ? Colors.red : Colors.green)),
          PopupMenuButton<String>(
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'edit', child: Text('Sửa')),
              const PopupMenuItem(value: 'delete', child: Text('Xóa')),
            ],
            onSelected: (action) {
              if (action == 'delete') _deleteItem(item['id'] as String);
              if (action == 'edit') _showAddDialog(editItem: item);
            },
          ),
        ]),
      ),
    );
  }

  String _freqLabel(String freq) => switch (freq) {
    'daily' => 'Hàng ngày',
    'weekly' => 'Hàng tuần',
    'monthly' => 'Hàng tháng',
    'yearly' => 'Hàng năm',
    _ => freq,
  };

  Future<void> _deleteItem(String id) async {
    final confirm = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Xóa giao dịch định kỳ'),
      content: const Text('Bạn có chắc muốn xóa?'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('Xóa')),
      ],
    ));
    if (confirm == true) {
      final db = await DatabaseHelper.instance.database;
      await db.update('recurring_transactions', {'is_active': 0, 'updated_at': DateTime.now().toIso8601String()}, where: 'id = ?', whereArgs: [id]);
      _load();
    }
  }

  void _showAddDialog({Map<String, dynamic>? editItem}) {
    final uuid = const Uuid();
    final titleCtrl = TextEditingController(text: editItem?['title'] as String? ?? '');
    final amountCtrl = TextEditingController(text: editItem != null ? ((editItem['amount'] as num?)?.toStringAsFixed(0) ?? '') : '');
    int type = editItem?['type'] as int? ?? 0;
    String frequency = editItem?['frequency'] as String? ?? 'monthly';
    String? categoryId = editItem?['category_id'] as String?;
    String? moduleId = editItem?['module_id'] as String?;
    String? accountId = editItem?['account_id'] as String?;
    DateTime nextDate = editItem?['next_date'] != null ? DateTime.parse(editItem!['next_date'] as String) : DateTime.now();

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheetState) => Padding(
        padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: MediaQuery.of(ctx).viewInsets.bottom + 16),
        child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(editItem != null ? 'Sửa giao dịch định kỳ' : 'Thêm giao dịch định kỳ', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 16),
          // Type
          SegmentedButton<int>(segments: const [
            ButtonSegment(value: 0, label: Text('Chi'), icon: Icon(Icons.arrow_upward, size: 16)),
            ButtonSegment(value: 1, label: Text('Thu'), icon: Icon(Icons.arrow_downward, size: 16)),
          ], selected: {type}, onSelectionChanged: (s) => setSheetState(() => type = s.first)),
          const SizedBox(height: 12),
          TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Tên', isDense: true, border: OutlineInputBorder())),
          const SizedBox(height: 12),
          TextField(controller: amountCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Số tiền', isDense: true, border: OutlineInputBorder())),
          const SizedBox(height: 12),
          // Frequency
          Text('Tần suất', style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 4),
          Wrap(spacing: 8, children: [
            for (final f in ['daily', 'weekly', 'monthly', 'yearly'])
              ChoiceChip(label: Text(_freqLabel(f)), selected: frequency == f, onSelected: (_) => setSheetState(() => frequency = f)),
          ]),
          const SizedBox(height: 12),
          // Next date
          InkWell(
            onTap: () async {
              final picked = await showDatePicker(context: context, initialDate: nextDate, firstDate: DateTime(2020), lastDate: DateTime(2030));
              if (picked != null) setSheetState(() => nextDate = picked);
            },
            child: InputDecorator(
              decoration: const InputDecoration(labelText: 'Ngày kế tiếp', isDense: true, border: OutlineInputBorder()),
              child: Text(Formatters.date(nextDate)),
            ),
          ),
          const SizedBox(height: 16),
          // Save
          SizedBox(width: double.infinity, height: 44, child: FilledButton(
            onPressed: () async {
              if (titleCtrl.text.trim().isEmpty || amountCtrl.text.trim().isEmpty) return;
              final db = await DatabaseHelper.instance.database;
              final now = DateTime.now().toIso8601String();
              final data = {
                'type': type, 'amount': double.tryParse(amountCtrl.text.replaceAll(',', '')) ?? 0,
                'title': titleCtrl.text.trim(), 'frequency': frequency,
                'next_date': nextDate.toIso8601String(),
                'category_id': categoryId, 'module_id': moduleId, 'account_id': accountId,
                'is_active': 1, 'is_auto': 0, 'updated_at': now,
              };
              if (editItem != null) {
                await db.update('recurring_transactions', data, where: 'id = ?', whereArgs: [editItem['id']]);
              } else {
                await db.insert('recurring_transactions', {'id': uuid.v4(), ...data, 'created_at': now});
              }
              if (ctx.mounted) Navigator.pop(ctx);
              _load();
            },
            child: Text(editItem != null ? 'Cập nhật' : 'Thêm'),
          )),
        ])),
      )),
    );
  }
}
