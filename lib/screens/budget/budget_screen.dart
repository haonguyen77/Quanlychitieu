import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../database/database_helper.dart';
import '../../providers/category_provider.dart';
import '../../providers/module_provider.dart';
import '../../utils/formatters.dart';

class BudgetScreen extends StatefulWidget {
  const BudgetScreen({super.key});

  @override
  State<BudgetScreen> createState() => _BudgetScreenState();
}

class _BudgetScreenState extends State<BudgetScreen> {
  List<Map<String, dynamic>> _budgets = [];
  bool _isLoading = true;
  int _selectedMonth = DateTime.now().month;
  int _selectedYear = DateTime.now().year;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final db = await DatabaseHelper.instance.database;
    final budgets = await db.rawQuery('''
      SELECT b.*, c.name as category_name, m.name as module_name
      FROM budgets b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN modules m ON b.module_id = m.id
      WHERE b.is_active = 1
      ORDER BY b.amount DESC
    ''');

    // Calculate spent for each budget
    final start = DateTime(_selectedYear, _selectedMonth, 1).toIso8601String();
    final end = DateTime(_selectedYear, _selectedMonth + 1, 1).toIso8601String();
    final List<Map<String, dynamic>> enriched = [];
    for (final b in budgets) {
      String where = 'date >= ? AND date < ? AND is_deleted = 0 AND type = 0';
      List<dynamic> args = [start, end];
      if (b['category_id'] != null) { where += ' AND category_id = ?'; args.add(b['category_id']); }
      if (b['module_id'] != null) { where += ' AND module_id = ?'; args.add(b['module_id']); }
      final spent = await db.rawQuery('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE $where', args);
      final spentAmount = (spent.first['total'] as num?)?.toDouble() ?? 0;
      enriched.add({...b, 'spent': spentAmount});
    }
    setState(() { _budgets = enriched; _isLoading = false; });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ngân sách')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _budgets.isEmpty
              ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.pie_chart_outline, size: 64, color: Theme.of(context).colorScheme.outline),
                  const SizedBox(height: 16),
                  Text('Chưa có ngân sách', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.outline)),
                  const SizedBox(height: 8),
                  Text('Đặt giới hạn chi tiêu theo danh mục/module', style: Theme.of(context).textTheme.bodySmall),
                ]))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(12),
                    children: [
                      // Month selector
                      Card(child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        child: Row(children: [
                          IconButton(icon: const Icon(Icons.chevron_left), onPressed: () { setState(() { _selectedMonth--; if (_selectedMonth < 1) { _selectedMonth = 12; _selectedYear--; } }); _load(); }),
                          Expanded(child: Text('Tháng $_selectedMonth/$_selectedYear', textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600))),
                          IconButton(icon: const Icon(Icons.chevron_right), onPressed: () { setState(() { _selectedMonth++; if (_selectedMonth > 12) { _selectedMonth = 1; _selectedYear++; } }); _load(); }),
                        ]),
                      )),
                      const SizedBox(height: 12),
                      for (final b in _budgets) _buildBudgetCard(b),
                    ],
                  ),
                ),
      floatingActionButton: FloatingActionButton(onPressed: _showAddBudget, child: const Icon(Icons.add)),
    );
  }

  Widget _buildBudgetCard(Map<String, dynamic> b) {
    final budget = (b['amount'] as num?)?.toDouble() ?? 0;
    final spent = (b['spent'] as num?)?.toDouble() ?? 0;
    final percent = budget > 0 ? (spent / budget).clamp(0.0, 1.5) : 0.0;
    final isOver = spent > budget;
    final isWarning = percent >= 0.8 && !isOver;
    final label = b['category_name'] ?? b['module_name'] ?? b['name'] ?? 'Ngân sách';
    final color = isOver ? Colors.red : isWarning ? Colors.orange : Colors.green;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(Icons.circle, size: 12, color: color),
            const SizedBox(width: 8),
            Expanded(child: Text(label, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600))),
            if (isOver) const Icon(Icons.warning_amber, size: 18, color: Colors.red),
            PopupMenuButton<String>(
              itemBuilder: (_) => [const PopupMenuItem(value: 'delete', child: Text('Xóa'))],
              onSelected: (a) { if (a == 'delete') _deleteBudget(b['id'] as String); },
            ),
          ]),
          const SizedBox(height: 8),
          ClipRRect(borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(value: percent.clamp(0.0, 1.0), minHeight: 8, color: color,
                backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest)),
          const SizedBox(height: 6),
          Row(children: [
            Text('${Formatters.currency(spent)} / ${Formatters.currency(budget)}', style: Theme.of(context).textTheme.bodySmall),
            const Spacer(),
            Text('${(percent * 100).toStringAsFixed(0)}%', style: TextStyle(fontWeight: FontWeight.w600, color: color, fontSize: 13)),
          ]),
          if (isOver) Padding(padding: const EdgeInsets.only(top: 4),
            child: Text('Vượt ${Formatters.currency(spent - budget)}', style: const TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.w500))),
        ]),
      ),
    );
  }

  Future<void> _deleteBudget(String id) async {
    final db = await DatabaseHelper.instance.database;
    await db.update('budgets', {'is_active': 0, 'updated_at': DateTime.now().toIso8601String()}, where: 'id = ?', whereArgs: [id]);
    _load();
  }

  void _showAddBudget() {
    final uuid = const Uuid();
    final nameCtrl = TextEditingController();
    final amountCtrl = TextEditingController();
    String? categoryId;
    String? moduleId;

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheetState) => Padding(
        padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: MediaQuery.of(ctx).viewInsets.bottom + 16),
        child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Thêm ngân sách', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 16),
          TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Tên ngân sách', isDense: true, border: OutlineInputBorder())),
          const SizedBox(height: 12),
          TextField(controller: amountCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Số tiền giới hạn/tháng', isDense: true, border: OutlineInputBorder(), suffixText: '₫')),
          const SizedBox(height: 12),
          // Category picker
          Consumer<CategoryProvider>(builder: (_, catP, __) {
            if (catP.expenseCategories.isEmpty) return const SizedBox.shrink();
            return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Danh mục (tùy chọn)', style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 4),
              Wrap(spacing: 6, runSpacing: 6, children: [
                FilterChip(label: const Text('Không'), selected: categoryId == null, onSelected: (_) => setSheetState(() => categoryId = null), visualDensity: VisualDensity.compact),
                for (final cat in catP.expenseCategories)
                  FilterChip(label: Text(cat.name), selected: categoryId == cat.id, onSelected: (_) => setSheetState(() => categoryId = categoryId == cat.id ? null : cat.id), visualDensity: VisualDensity.compact),
              ]),
            ]);
          }),
          const SizedBox(height: 12),
          // Module picker
          Consumer<ModuleProvider>(builder: (_, modP, __) {
            if (modP.modules.isEmpty) return const SizedBox.shrink();
            return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Module (tùy chọn)', style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 4),
              Wrap(spacing: 6, runSpacing: 6, children: [
                FilterChip(label: const Text('Không'), selected: moduleId == null, onSelected: (_) => setSheetState(() => moduleId = null), visualDensity: VisualDensity.compact),
                for (final mod in modP.modules)
                  FilterChip(label: Text(mod.name), selected: moduleId == mod.id, onSelected: (_) => setSheetState(() => moduleId = moduleId == mod.id ? null : mod.id), visualDensity: VisualDensity.compact),
              ]),
            ]);
          }),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, height: 44, child: FilledButton(
            onPressed: () async {
              if (nameCtrl.text.trim().isEmpty || amountCtrl.text.trim().isEmpty) return;
              final db = await DatabaseHelper.instance.database;
              final now = DateTime.now().toIso8601String();
              await db.insert('budgets', {
                'id': uuid.v4(), 'name': nameCtrl.text.trim(),
                'amount': double.tryParse(amountCtrl.text.replaceAll(',', '')) ?? 0,
                'category_id': categoryId, 'module_id': moduleId,
                'period': 'monthly', 'is_active': 1, 'created_at': now, 'updated_at': now,
              });
              if (ctx.mounted) Navigator.pop(ctx);
              _load();
            },
            child: const Text('Thêm ngân sách'),
          )),
        ])),
      )),
    );
  }
}
