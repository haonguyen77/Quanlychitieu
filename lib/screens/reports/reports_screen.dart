import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../providers/transaction_provider.dart';
import '../../models/transaction.dart';
import '../../utils/formatters.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  int _selectedYear = DateTime.now().year;
  int _selectedMonth = DateTime.now().month;
  List<Transaction> _transactions = [];
  List<Transaction> _prevMonthTransactions = [];
  bool _isLoading = true;

  // Comparison chart state
  _CompareMode _compareMode = _CompareMode.months6;
  _GroupBy _groupBy = _GroupBy.combined;
  Set<String> _comparisonFilter = {};
  bool _comparisonFilterActive = false;
  Map<String, Map<String, double>> _comparisonData = {}; // label -> {item: amount}
  List<String> _comparisonLabels = [];

  // Category/Module chart filters
  Set<String> _categoryChartFilter = {};
  Set<String> _moduleChartFilter = {};
  bool _categoryFilterActive = false;
  bool _moduleFilterActive = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final provider = context.read<TransactionProvider>();

    final start = DateTime(_selectedYear, _selectedMonth, 1);
    final end = DateTime(_selectedYear, _selectedMonth + 1, 1);
    _transactions = await provider.search(startDate: start, endDate: end);

    final prevStart = DateTime(_selectedYear, _selectedMonth - 1, 1);
    final prevEnd = DateTime(_selectedYear, _selectedMonth, 1);
    _prevMonthTransactions = await provider.search(startDate: prevStart, endDate: prevEnd);

    await _loadComparisonData();
    setState(() => _isLoading = false);
  }

  Future<void> _loadComparisonData() async {
    final provider = context.read<TransactionProvider>();
    _comparisonData = {};
    _comparisonLabels = [];

    switch (_compareMode) {
      case _CompareMode.months6:
        for (int i = 5; i >= 0; i--) {
          int m = _selectedMonth - i;
          int y = _selectedYear;
          while (m < 1) { m += 12; y--; }
          final mStart = DateTime(y, m, 1);
          final mEnd = DateTime(y, m + 1, 1);
          final data = await provider.search(startDate: mStart, endDate: mEnd);
          final label = 'T$m';
          _comparisonLabels.add(label);
          _comparisonData[label] = _groupTransactions(data);
        }
        break;
      case _CompareMode.months12:
        for (int i = 11; i >= 0; i--) {
          int m = _selectedMonth - i;
          int y = _selectedYear;
          while (m < 1) { m += 12; y--; }
          final mStart = DateTime(y, m, 1);
          final mEnd = DateTime(y, m + 1, 1);
          final data = await provider.search(startDate: mStart, endDate: mEnd);
          final label = 'T$m';
          _comparisonLabels.add(label);
          _comparisonData[label] = _groupTransactions(data);
        }
        break;
      case _CompareMode.years:
        // Compare same month across multiple years (3 years)
        for (int i = 2; i >= 0; i--) {
          final y = _selectedYear - i;
          final mStart = DateTime(y, _selectedMonth, 1);
          final mEnd = DateTime(y, _selectedMonth + 1, 1);
          final data = await provider.search(startDate: mStart, endDate: mEnd);
          final label = 'T$_selectedMonth/$y';
          _comparisonLabels.add(label);
          _comparisonData[label] = _groupTransactions(data);
        }
        break;
      case _CompareMode.yearTotal:
        // Compare full year totals (3 years)
        for (int i = 2; i >= 0; i--) {
          final y = _selectedYear - i;
          final yStart = DateTime(y, 1, 1);
          final yEnd = DateTime(y + 1, 1, 1);
          final data = await provider.search(startDate: yStart, endDate: yEnd);
          final label = '$y';
          _comparisonLabels.add(label);
          _comparisonData[label] = _groupTransactions(data);
        }
        break;
    }
  }

  Map<String, double> _groupTransactions(List<Transaction> txns) {
    final map = <String, double>{};
    for (final t in txns.where((t) => t.isExpense)) {
      String label;
      switch (_groupBy) {
        case _GroupBy.category:
          label = t.categoryName ?? 'Khác';
          break;
        case _GroupBy.module:
          label = t.moduleName ?? 'Chi tiêu';
          break;
        case _GroupBy.combined:
          label = (t.moduleName != null && t.moduleName != 'Chi tiêu' && t.moduleName!.isNotEmpty)
              ? t.moduleName!
              : (t.categoryName ?? 'Khác');
          break;
      }
      map[label] = (map[label] ?? 0) + t.amount;
    }
    return map;
  }

  double get _totalExpense => _transactions.where((t) => t.isExpense).fold(0.0, (s, t) => s + t.amount);
  double get _totalIncome => _transactions.where((t) => t.isIncome).fold(0.0, (s, t) => s + t.amount);
  double get _prevExpense => _prevMonthTransactions.where((t) => t.isExpense).fold(0.0, (s, t) => s + t.amount);
  int get _daysInMonth => DateTime(_selectedYear, _selectedMonth + 1, 0).day;
  double get _dailyAverage => _daysInMonth > 0 ? _totalExpense / DateTime.now().day.clamp(1, _daysInMonth) : 0;
  double get _predictedTotal => _dailyAverage * _daysInMonth;
  double get _changePercent => _prevExpense > 0 ? ((_totalExpense - _prevExpense) / _prevExpense * 100) : 0;

  Map<String, double> get _expenseByCategoryOnly {
    final map = <String, double>{};
    for (final t in _transactions.where((t) => t.isExpense)) {
      final cat = t.categoryName ?? 'Khác';
      map[cat] = (map[cat] ?? 0) + t.amount;
    }
    return map;
  }

  Map<String, double> get _expenseByModule {
    final map = <String, double>{};
    for (final t in _transactions.where((t) => t.isExpense)) {
      final mod = t.moduleName ?? 'Chi tiêu';
      map[mod] = (map[mod] ?? 0) + t.amount;
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Báo cáo')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildMonthSelector(),
                    const SizedBox(height: 16),
                    _buildSummaryCards(),
                    const SizedBox(height: 16),
                    _buildAnalysis(),
                    const SizedBox(height: 24),
                    _buildCategoryPieChart(),
                    const SizedBox(height: 24),
                    _buildModulePieChart(),
                    const SizedBox(height: 24),
                    _buildComparisonChart(),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildMonthSelector() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Row(
          children: [
            IconButton(icon: const Icon(Icons.chevron_left), onPressed: () {
              setState(() {
                _selectedMonth--;
                if (_selectedMonth < 1) { _selectedMonth = 12; _selectedYear--; }
              });
              _loadData();
            }),
            Expanded(
              child: GestureDetector(
                onTap: _showMonthPicker,
                child: Text('Tháng $_selectedMonth/$_selectedYear',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600, decoration: TextDecoration.underline)),
              ),
            ),
            IconButton(icon: const Icon(Icons.chevron_right), onPressed: () {
              setState(() {
                _selectedMonth++;
                if (_selectedMonth > 12) { _selectedMonth = 1; _selectedYear++; }
              });
              _loadData();
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryCards() {
    return Row(
      children: [
        Expanded(child: _StatCard(label: 'Chi', amount: _totalExpense, color: Colors.red)),
        const SizedBox(width: 8),
        Expanded(child: _StatCard(label: 'Thu', amount: _totalIncome, color: Colors.green)),
        const SizedBox(width: 8),
        Expanded(child: _StatCard(label: 'Số dư', amount: _totalIncome - _totalExpense,
            color: Theme.of(context).colorScheme.primary)),
      ],
    );
  }

  Widget _buildAnalysis() {
    final analyses = <String>[];
    if (_changePercent != 0) {
      final direction = _changePercent > 0 ? 'tăng' : 'giảm';
      analyses.add('Chi tiêu tháng này $direction ${_changePercent.abs().toStringAsFixed(1)}% so với tháng trước');
    }
    analyses.add('Trung bình mỗi ngày chi ${Formatters.currency(_dailyAverage)}');
    analyses.add('Dự đoán chi cuối tháng: ${Formatters.currency(_predictedTotal)}');
    final topCat = _expenseByCategoryOnly.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    if (topCat.isNotEmpty) {
      analyses.add('Danh mục chi nhiều nhất: ${topCat.first.key} (${Formatters.currency(topCat.first.value)})');
    }
    analyses.add('Tổng ${_transactions.length} giao dịch trong tháng');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(Icons.analytics, size: 20, color: Theme.of(context).colorScheme.primary),
              const SizedBox(width: 8),
              Text('Phân tích', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
            ]),
            const SizedBox(height: 12),
            for (final text in analyses)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('• ', style: TextStyle(fontWeight: FontWeight.bold)),
                  Expanded(child: Text(text, style: Theme.of(context).textTheme.bodyMedium)),
                ]),
              ),
          ],
        ),
      ),
    );
  }

  // ===== CATEGORY PIE CHART =====
  Widget _buildCategoryPieChart() {
    final allData = _expenseByCategoryOnly;
    if (allData.isEmpty) {
      return Card(child: Padding(padding: const EdgeInsets.all(24),
          child: Center(child: Text('Chưa có dữ liệu chi tiêu',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.outline)))));
    }
    final data = _categoryFilterActive && _categoryChartFilter.isNotEmpty
        ? Map.fromEntries(allData.entries.where((e) => _categoryChartFilter.contains(e.key)))
        : allData;
    if (data.isEmpty) return const SizedBox.shrink();

    final sorted = data.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    final total = sorted.fold(0.0, (s, e) => s + e.value);
    final colors = [Colors.red, Colors.blue, Colors.orange, Colors.green, Colors.purple,
        Colors.teal, Colors.pink, Colors.indigo, Colors.amber, Colors.cyan];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text('Chi theo danh mục', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600))),
            IconButton(
              icon: Icon(_categoryFilterActive ? Icons.filter_alt : Icons.filter_alt_outlined, size: 20),
              tooltip: 'Chọn danh mục hiển thị',
              onPressed: () => _showItemFilter(
                title: 'Chọn danh mục', allItems: allData.keys.toSet(),
                selectedItems: _categoryChartFilter, isActive: _categoryFilterActive,
                onApply: (sel, active) => setState(() { _categoryChartFilter = sel; _categoryFilterActive = active; }),
              ),
            ),
          ]),
          const SizedBox(height: 12),
          SizedBox(height: 180, child: PieChart(PieChartData(
            sectionsSpace: 2, centerSpaceRadius: 40,
            sections: [for (int i = 0; i < sorted.length && i < 10; i++)
              PieChartSectionData(value: sorted[i].value,
                title: '${(sorted[i].value / total * 100).toStringAsFixed(0)}%',
                color: colors[i % colors.length], radius: 50,
                titleStyle: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.bold))],
          ))),
          const SizedBox(height: 12),
          Wrap(spacing: 12, runSpacing: 4, children: [
            for (int i = 0; i < sorted.length && i < 10; i++)
              Row(mainAxisSize: MainAxisSize.min, children: [
                Container(width: 12, height: 12, decoration: BoxDecoration(color: colors[i % colors.length], borderRadius: BorderRadius.circular(2))),
                const SizedBox(width: 4),
                Text('${sorted[i].key} (${Formatters.currency(sorted[i].value)})', style: Theme.of(context).textTheme.bodySmall),
              ]),
          ]),
        ]),
      ),
    );
  }

  // ===== MODULE PIE CHART =====
  Widget _buildModulePieChart() {
    final allData = _expenseByModule;
    if (allData.isEmpty || allData.length <= 1) return const SizedBox.shrink();

    final data = _moduleFilterActive && _moduleChartFilter.isNotEmpty
        ? Map.fromEntries(allData.entries.where((e) => _moduleChartFilter.contains(e.key)))
        : allData;
    if (data.isEmpty) return const SizedBox.shrink();

    final sorted = data.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    final total = sorted.fold(0.0, (s, e) => s + e.value);
    final colors = [Colors.red, Colors.orange, Colors.amber, Colors.green, Colors.teal, Colors.blue, Colors.purple, Colors.pink];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text('Chi theo module', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600))),
            IconButton(
              icon: Icon(_moduleFilterActive ? Icons.filter_alt : Icons.filter_alt_outlined, size: 20),
              tooltip: 'Chọn module hiển thị',
              onPressed: () => _showItemFilter(
                title: 'Chọn module', allItems: allData.keys.toSet(),
                selectedItems: _moduleChartFilter, isActive: _moduleFilterActive,
                onApply: (sel, active) => setState(() { _moduleChartFilter = sel; _moduleFilterActive = active; }),
              ),
            ),
          ]),
          const SizedBox(height: 12),
          for (int i = 0; i < sorted.length; i++)
            Padding(padding: const EdgeInsets.only(bottom: 8), child: Column(
              crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Container(width: 12, height: 12, decoration: BoxDecoration(color: colors[i % colors.length], borderRadius: BorderRadius.circular(2))),
                  const SizedBox(width: 8),
                  Expanded(child: Text(sorted[i].key)),
                  Text(Formatters.currency(sorted[i].value), style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(width: 8),
                  SizedBox(width: 40, child: Text('${(total > 0 ? sorted[i].value / total * 100 : 0).toStringAsFixed(0)}%',
                      style: Theme.of(context).textTheme.bodySmall, textAlign: TextAlign.right)),
                ]),
                const SizedBox(height: 4),
                ClipRRect(borderRadius: BorderRadius.circular(2),
                  child: LinearProgressIndicator(value: total > 0 ? sorted[i].value / total : 0, minHeight: 4,
                      color: colors[i % colors.length], backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest)),
              ],
            )),
        ]),
      ),
    );
  }

  // ===== COMPARISON BAR CHART =====
  Widget _buildComparisonChart() {
    if (_comparisonData.isEmpty) return const SizedBox.shrink();

    // Collect all item keys across all periods
    final allItems = <String>{};
    for (final map in _comparisonData.values) {
      allItems.addAll(map.keys);
    }
    if (allItems.isEmpty) return const SizedBox.shrink();

    // Apply filter
    final displayItems = _comparisonFilterActive && _comparisonFilter.isNotEmpty
        ? _comparisonFilter : allItems;

    // Calculate bar totals
    double maxValue = 0;
    final barValues = <String, double>{};
    for (final label in _comparisonLabels) {
      double total = 0;
      final map = _comparisonData[label] ?? {};
      for (final item in displayItems) {
        total += map[item] ?? 0;
      }
      barValues[label] = total;
      if (total > maxValue) maxValue = total;
    }

    final modeLabel = switch (_compareMode) {
      _CompareMode.months6 => 'So sánh 6 tháng',
      _CompareMode.months12 => 'So sánh 12 tháng',
      _CompareMode.years => 'So sánh cùng tháng qua các năm',
      _CompareMode.yearTotal => 'So sánh tổng năm',
    };

    final groupLabel = switch (_groupBy) {
      _GroupBy.category => 'Danh mục',
      _GroupBy.module => 'Module',
      _GroupBy.combined => 'Tổng hợp',
    };

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Title row with settings
          Row(children: [
            Expanded(child: Text(modeLabel, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600))),
            IconButton(
              icon: const Icon(Icons.tune, size: 20),
              tooltip: 'Cài đặt biểu đồ',
              onPressed: _showComparisonSettings,
            ),
            IconButton(
              icon: Icon(_comparisonFilterActive ? Icons.filter_alt : Icons.filter_alt_outlined, size: 20),
              tooltip: 'Chọn mục hiển thị',
              onPressed: () => _showItemFilter(
                title: 'Chọn mục so sánh ($groupLabel)', allItems: allItems,
                selectedItems: _comparisonFilter, isActive: _comparisonFilterActive,
                onApply: (sel, active) => setState(() { _comparisonFilter = sel; _comparisonFilterActive = active; }),
              ),
            ),
          ]),
          // Filter indicator
          if (_comparisonFilterActive && _comparisonFilter.isNotEmpty)
            Padding(padding: const EdgeInsets.only(bottom: 8),
              child: Wrap(spacing: 4, runSpacing: 4, children: [
                for (final item in _comparisonFilter)
                  Chip(label: Text(item, style: const TextStyle(fontSize: 11)),
                      visualDensity: VisualDensity.compact,
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap, padding: EdgeInsets.zero),
              ])),
          const SizedBox(height: 8),
          // Bar chart
          SizedBox(
            height: 200,
            child: BarChart(BarChartData(
              alignment: BarChartAlignment.spaceAround,
              maxY: maxValue > 0 ? maxValue * 1.2 : 100,
              barTouchData: BarTouchData(
                touchTooltipData: BarTouchTooltipData(
                  getTooltipItem: (group, gi, rod, ri) => BarTooltipItem(
                    '${_comparisonLabels[group.x]}\n${Formatters.currency(rod.toY)}',
                    const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              titlesData: FlTitlesData(
                leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true,
                  getTitlesWidget: (value, meta) {
                    final idx = value.toInt();
                    if (idx < 0 || idx >= _comparisonLabels.length) return const SizedBox.shrink();
                    return Padding(padding: const EdgeInsets.only(top: 6),
                      child: Text(_comparisonLabels[idx], style: const TextStyle(fontSize: 10)));
                  },
                )),
              ),
              borderData: FlBorderData(show: false),
              gridData: const FlGridData(show: false),
              barGroups: [
                for (int i = 0; i < _comparisonLabels.length; i++)
                  BarChartGroupData(x: i, barRods: [
                    BarChartRodData(
                      toY: barValues[_comparisonLabels[i]] ?? 0,
                      color: i == _comparisonLabels.length - 1
                          ? Theme.of(context).colorScheme.primary
                          : Theme.of(context).colorScheme.primary.withValues(alpha: 0.4),
                      width: _comparisonLabels.length > 8 ? 16 : 28,
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                    ),
                  ]),
              ],
            )),
          ),
        ]),
      ),
    );
  }

  // ===== COMPARISON SETTINGS DIALOG =====
  void _showComparisonSettings() {
    var tempMode = _compareMode;
    var tempGroup = _groupBy;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: MediaQuery.of(ctx).viewInsets.bottom + 16),
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Cài đặt biểu đồ so sánh', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 16),
              Text('So sánh theo:', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final mode in _CompareMode.values)
                  ChoiceChip(
                    label: Text(mode.label),
                    selected: tempMode == mode,
                    onSelected: (_) => setSheetState(() => tempMode = mode),
                  ),
              ]),
              const SizedBox(height: 16),
              Text('Nhóm theo:', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final g in _GroupBy.values)
                  ChoiceChip(
                    label: Text(g.label),
                    selected: tempGroup == g,
                    onSelected: (_) => setSheetState(() => tempGroup = g),
                  ),
              ]),
              const SizedBox(height: 20),
              SizedBox(width: double.infinity, child: FilledButton(
                onPressed: () {
                  setState(() {
                    _compareMode = tempMode;
                    _groupBy = tempGroup;
                    _comparisonFilter = {};
                    _comparisonFilterActive = false;
                  });
                  Navigator.pop(ctx);
                  _loadData();
                },
                child: const Text('Áp dụng'),
              )),
              const SizedBox(height: 8),
            ]),
          ),
        ),
      ),
    );
  }

  // ===== ITEM FILTER DIALOG =====
  void _showItemFilter({
    required String title, required Set<String> allItems,
    required Set<String> selectedItems, required bool isActive,
    required void Function(Set<String>, bool) onApply,
  }) {
    final tempSelected = Set<String>.from(selectedItems.isEmpty ? allItems : selectedItems);
    showModalBottomSheet(
      context: context, isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          final sorted = allItems.toList()..sort();
          return DraggableScrollableSheet(
            initialChildSize: 0.6, minChildSize: 0.4, maxChildSize: 0.85, expand: false,
            builder: (ctx, scrollController) => Padding(
              padding: const EdgeInsets.all(16),
              child: Column(children: [
                Row(children: [
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                  const Spacer(),
                  TextButton(onPressed: () => setSheetState(() => tempSelected.addAll(allItems)), child: const Text('Tất cả')),
                  TextButton(onPressed: () => setSheetState(() => tempSelected.clear()), child: const Text('Bỏ hết')),
                ]),
                const Divider(),
                Expanded(child: ListView.builder(
                  controller: scrollController, itemCount: sorted.length,
                  itemBuilder: (ctx, i) => CheckboxListTile(
                    dense: true, title: Text(sorted[i]),
                    value: tempSelected.contains(sorted[i]),
                    onChanged: (v) => setSheetState(() {
                      if (v == true) tempSelected.add(sorted[i]); else tempSelected.remove(sorted[i]);
                    }),
                  ),
                )),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(child: OutlinedButton(
                    onPressed: () { onApply({}, false); Navigator.pop(ctx); },
                    child: const Text('Xóa bộ lọc'),
                  )),
                  const SizedBox(width: 12),
                  Expanded(child: FilledButton(
                    onPressed: () {
                      final active = tempSelected.length < allItems.length && tempSelected.isNotEmpty;
                      onApply(tempSelected, active);
                      Navigator.pop(ctx);
                    },
                    child: const Text('Áp dụng'),
                  )),
                ]),
              ]),
            ),
          );
        },
      ),
    );
  }

  void _showMonthPicker() {
    int tempYear = _selectedYear;
    int tempMonth = _selectedMonth;
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Chọn tháng'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              IconButton(icon: const Icon(Icons.chevron_left), onPressed: () => setDialogState(() => tempYear--)),
              Text('$tempYear', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
              IconButton(icon: const Icon(Icons.chevron_right), onPressed: () => setDialogState(() => tempYear++)),
            ]),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 4, shrinkWrap: true, mainAxisSpacing: 8, crossAxisSpacing: 8,
              children: [for (int m = 1; m <= 12; m++)
                InkWell(
                  onTap: () => setDialogState(() => tempMonth = m),
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: tempMonth == m ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text('T$m', style: TextStyle(color: tempMonth == m ? Colors.white : null, fontWeight: tempMonth == m ? FontWeight.bold : null)),
                  ),
                ),
              ],
            ),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
            FilledButton(onPressed: () {
              setState(() { _selectedYear = tempYear; _selectedMonth = tempMonth; });
              Navigator.pop(ctx);
              _loadData();
            }, child: const Text('Chọn')),
          ],
        ),
      ),
    );
  }
}

// ===== ENUMS =====
enum _CompareMode {
  months6, months12, years, yearTotal;
  String get label => switch (this) {
    _CompareMode.months6 => '6 tháng',
    _CompareMode.months12 => '12 tháng',
    _CompareMode.years => 'Cùng tháng qua năm',
    _CompareMode.yearTotal => 'Tổng theo năm',
  };
}

enum _GroupBy {
  category, module, combined;
  String get label => switch (this) {
    _GroupBy.category => 'Danh mục',
    _GroupBy.module => 'Module',
    _GroupBy.combined => 'Tổng hợp',
  };
}

class _StatCard extends StatelessWidget {
  final String label;
  final double amount;
  final Color color;
  const _StatCard({required this.label, required this.amount, required this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(children: [
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 4),
          FittedBox(fit: BoxFit.scaleDown,
            child: Text(Formatters.currency(amount),
                style: Theme.of(context).textTheme.titleSmall?.copyWith(color: color, fontWeight: FontWeight.bold))),
        ]),
      ),
    );
  }
}
