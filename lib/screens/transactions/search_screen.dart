import 'package:flutter/material.dart' hide Category;
import 'package:provider/provider.dart';
import '../../providers/transaction_provider.dart';
import '../../providers/category_provider.dart';
import '../../providers/account_provider.dart';
import '../../providers/module_provider.dart';
import '../../models/transaction.dart';
import '../../models/category.dart';
import '../../utils/formatters.dart';
import 'add_transaction_screen.dart';
import 'transaction_detail_screen.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _keywordController = TextEditingController();
  DateTime? _startDate;
  DateTime? _endDate;
  double? _minAmount;
  double? _maxAmount;
  String? _selectedCategoryId;
  String? _selectedModuleId;
  String? _selectedAccountId;
  List<Transaction> _results = [];
  bool _isSearching = false;
  bool _hasSearched = false;
  bool _showFilters = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CategoryProvider>().loadCategories();
      context.read<AccountProvider>().loadAccounts();
      context.read<ModuleProvider>().loadModules();
    });
  }

  @override
  void dispose() {
    _keywordController.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    setState(() { _isSearching = true; _hasSearched = true; });
    final provider = context.read<TransactionProvider>();
    _results = await provider.search(
      keyword: _keywordController.text.trim().isEmpty ? null : _keywordController.text.trim(),
      startDate: _startDate,
      endDate: _endDate?.add(const Duration(days: 1)),
      minAmount: _minAmount,
      maxAmount: _maxAmount,
      categoryId: _selectedCategoryId,
      moduleId: _selectedModuleId,
      accountId: _selectedAccountId,
    );
    setState(() { _isSearching = false; _showFilters = false; });
  }

  void _clearFilters() {
    setState(() {
      _keywordController.clear();
      _startDate = null;
      _endDate = null;
      _minAmount = null;
      _maxAmount = null;
      _selectedCategoryId = null;
      _selectedModuleId = null;
      _selectedAccountId = null;
      _results = [];
      _hasSearched = false;
      _showFilters = true;
    });
  }

  double get _totalExpense => _results.where((t) => t.isExpense).fold(0.0, (s, t) => s + t.amount);
  double get _totalIncome => _results.where((t) => t.isIncome).fold(0.0, (s, t) => s + t.amount);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tìm kiếm'),
        actions: [
          if (_hasSearched)
            IconButton(icon: const Icon(Icons.filter_list),
              onPressed: () => setState(() => _showFilters = !_showFilters)),
          IconButton(icon: const Icon(Icons.clear_all), tooltip: 'Xóa bộ lọc', onPressed: _clearFilters),
        ],
      ),
      body: Column(
        children: [
          // Filter section
          if (_showFilters) _buildFilters(),
          // Summary
          if (_hasSearched && _results.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              child: Row(children: [
                Text('${_results.length} kết quả', style: Theme.of(context).textTheme.bodySmall),
                const Spacer(),
                if (_totalExpense > 0) Text('Chi: ${Formatters.currency(_totalExpense)}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.red)),
                if (_totalIncome > 0) ...[
                  const SizedBox(width: 12),
                  Text('Thu: ${Formatters.currency(_totalIncome)}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.green)),
                ],
              ]),
            ),
          // Results
          Expanded(
            child: _isSearching
                ? const Center(child: CircularProgressIndicator())
                : !_hasSearched
                    ? Center(child: Text('Nhập điều kiện và nhấn Tìm', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.outline)))
                    : _results.isEmpty
                        ? Center(child: Text('Không tìm thấy kết quả', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.outline)))
                        : ListView.builder(
                            padding: const EdgeInsets.all(8),
                            itemCount: _results.length,
                            itemBuilder: (context, index) => _buildTransactionTile(_results[index]),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilters() {
    return Card(
      margin: const EdgeInsets.all(12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Keyword
          TextField(
            controller: _keywordController,
            decoration: InputDecoration(
              hintText: 'Tìm theo tên, ghi chú...',
              prefixIcon: const Icon(Icons.search),
              isDense: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onSubmitted: (_) => _search(),
          ),
          const SizedBox(height: 12),
          // Date range
          Row(children: [
            Expanded(child: InkWell(
              onTap: () async {
                final picked = await showDatePicker(context: context, initialDate: _startDate ?? DateTime.now(), firstDate: DateTime(2020), lastDate: DateTime.now());
                if (picked != null) setState(() => _startDate = picked);
              },
              child: InputDecorator(
                decoration: const InputDecoration(labelText: 'Từ ngày', isDense: true, border: OutlineInputBorder()),
                child: Text(_startDate != null ? Formatters.date(_startDate!) : '--'),
              ),
            )),
            const SizedBox(width: 8),
            Expanded(child: InkWell(
              onTap: () async {
                final picked = await showDatePicker(context: context, initialDate: _endDate ?? DateTime.now(), firstDate: DateTime(2020), lastDate: DateTime.now().add(const Duration(days: 1)));
                if (picked != null) setState(() => _endDate = picked);
              },
              child: InputDecorator(
                decoration: const InputDecoration(labelText: 'Đến ngày', isDense: true, border: OutlineInputBorder()),
                child: Text(_endDate != null ? Formatters.date(_endDate!) : '--'),
              ),
            )),
          ]),
          const SizedBox(height: 12),
          // Amount range
          Row(children: [
            Expanded(child: TextFormField(
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Từ số tiền', isDense: true, border: OutlineInputBorder()),
              onChanged: (v) => _minAmount = double.tryParse(v.replaceAll(',', '')),
            )),
            const SizedBox(width: 8),
            Expanded(child: TextFormField(
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Đến số tiền', isDense: true, border: OutlineInputBorder()),
              onChanged: (v) => _maxAmount = double.tryParse(v.replaceAll(',', '')),
            )),
          ]),
          const SizedBox(height: 12),
          // Category / Module / Account chips row
          Consumer3<CategoryProvider, ModuleProvider, AccountProvider>(
            builder: (context, catP, modP, accP, _) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Module
              if (modP.modules.isNotEmpty) ...[
                Text('Module', style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 4),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  FilterChip(label: const Text('Tất cả'), selected: _selectedModuleId == null,
                    onSelected: (_) => setState(() => _selectedModuleId = null), visualDensity: VisualDensity.compact),
                  for (final mod in modP.modules)
                    FilterChip(label: Text(mod.name), selected: _selectedModuleId == mod.id,
                      onSelected: (_) => setState(() => _selectedModuleId = _selectedModuleId == mod.id ? null : mod.id), visualDensity: VisualDensity.compact),
                ]),
                const SizedBox(height: 8),
              ],
              // Category
              if (catP.expenseCategories.isNotEmpty) ...[
                Text('Danh mục', style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 4),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  FilterChip(label: const Text('Tất cả'), selected: _selectedCategoryId == null,
                    onSelected: (_) => setState(() => _selectedCategoryId = null), visualDensity: VisualDensity.compact),
                  for (final cat in catP.expenseCategories)
                    FilterChip(label: Text(cat.name), selected: _selectedCategoryId == cat.id,
                      onSelected: (_) => setState(() => _selectedCategoryId = _selectedCategoryId == cat.id ? null : cat.id), visualDensity: VisualDensity.compact),
                ]),
                const SizedBox(height: 8),
              ],
              // Account
              if (accP.accounts.isNotEmpty) ...[
                Text('Tài khoản', style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 4),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  FilterChip(label: const Text('Tất cả'), selected: _selectedAccountId == null,
                    onSelected: (_) => setState(() => _selectedAccountId = null), visualDensity: VisualDensity.compact),
                  for (final acc in accP.accounts)
                    FilterChip(label: Text(acc.name), selected: _selectedAccountId == acc.id,
                      onSelected: (_) => setState(() => _selectedAccountId = _selectedAccountId == acc.id ? null : acc.id), visualDensity: VisualDensity.compact),
                ]),
              ],
            ]),
          ),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, height: 44, child: FilledButton.icon(
            onPressed: _search, icon: const Icon(Icons.search), label: const Text('Tìm kiếm'),
          )),
        ]),
      ),
    );
  }

  Widget _buildTransactionTile(Transaction t) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 3, horizontal: 4),
      child: ListTile(
        dense: true,
        leading: CircleAvatar(
          radius: 16,
          backgroundColor: t.isExpense ? Colors.red.withValues(alpha: 0.1) : Colors.green.withValues(alpha: 0.1),
          child: Icon(t.isExpense ? Icons.arrow_upward : Icons.arrow_downward, size: 16,
              color: t.isExpense ? Colors.red : Colors.green),
        ),
        title: Text(t.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text('${Formatters.date(t.date)} • ${t.categoryName ?? ''} • ${t.moduleName ?? ''}',
            style: Theme.of(context).textTheme.bodySmall),
        trailing: Text(
          '${t.isExpense ? "-" : "+"}${Formatters.currency(t.amount)}',
          style: TextStyle(fontWeight: FontWeight.w600, color: t.isExpense ? Colors.red : Colors.green, fontSize: 13),
        ),
        onTap: () async {
          await Navigator.push(context, MaterialPageRoute(
            builder: (_) => TransactionDetailScreen(transaction: t),
          ));
          _search();
        },
      ),
    );
  }
}
