import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../models/transaction.dart';
import '../../providers/transaction_provider.dart';
import '../../repositories/transaction_repository.dart';
import '../../utils/formatters.dart';
import '../../utils/transaction_styles.dart';
import '../transactions/add_transaction_screen.dart';
import '../transactions/transaction_detail_screen.dart';

enum FilterPeriod { week, month, year, all }

class ExpenseScreen extends StatefulWidget {
  const ExpenseScreen({super.key});

  @override
  State<ExpenseScreen> createState() => _ExpenseScreenState();
}

class _ExpenseScreenState extends State<ExpenseScreen> {
  static const _primaryBlue = Color(0xFF1264F5);
  static const _darkText = Color(0xFF0F1F4D);
  static const _red = Color(0xFFEF3030);
  static const _green = Color(0xFF20A84A);
  static const _bgLight = Color(0xFFF5F7FA);
  static const _border = Color(0xFFE5E7EB);

  FilterPeriod _currentPeriod = FilterPeriod.month;
  DateTime _referenceDate = DateTime.now();
  DateTime? _customFromDate;
  DateTime? _customToDate;
  List<Transaction> _transactions = [];
  bool _isLoading = false;
  final TransactionRepository _repository = TransactionRepository();

  // Search state
  bool _isSearching = false;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  List<String> _searchSuggestions = [];

  // Filter visibility (default: hidden)
  bool _showFilter = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  /// Public method to allow external reload (e.g. after adding transaction from HomeScreen)
  void reloadData() => _loadData();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // ─── Date Range ─────────────────────────────────────────────────────────

  DateTime get _startDate {
    if (_customFromDate != null) return _customFromDate!;
    switch (_currentPeriod) {
      case FilterPeriod.week:
        final weekday = _referenceDate.weekday;
        return DateTime(_referenceDate.year, _referenceDate.month, _referenceDate.day - (weekday - 1));
      case FilterPeriod.month:
        return DateTime(_referenceDate.year, _referenceDate.month, 1);
      case FilterPeriod.year:
        return DateTime(_referenceDate.year, 1, 1);
      case FilterPeriod.all:
        return DateTime(2020, 1, 1);
    }
  }

  DateTime get _endDate {
    if (_customToDate != null) return _customToDate!;
    switch (_currentPeriod) {
      case FilterPeriod.week:
        final weekday = _referenceDate.weekday;
        final weekStart = DateTime(_referenceDate.year, _referenceDate.month, _referenceDate.day - (weekday - 1));
        return weekStart.add(const Duration(days: 7)).subtract(const Duration(milliseconds: 1));
      case FilterPeriod.month:
        return DateTime(_referenceDate.year, _referenceDate.month + 1, 1).subtract(const Duration(milliseconds: 1));
      case FilterPeriod.year:
        return DateTime(_referenceDate.year + 1, 1, 1).subtract(const Duration(milliseconds: 1));
      case FilterPeriod.all:
        return DateTime(2099, 12, 31, 23, 59, 59);
    }
  }

  void _previousPeriod() {
    setState(() {
      _customFromDate = null;
      _customToDate = null;
      switch (_currentPeriod) {
        case FilterPeriod.week:
          _referenceDate = _referenceDate.subtract(const Duration(days: 7));
        case FilterPeriod.month:
          _referenceDate = DateTime(_referenceDate.year, _referenceDate.month - 1, 1);
        case FilterPeriod.year:
          _referenceDate = DateTime(_referenceDate.year - 1, 1, 1);
        case FilterPeriod.all:
          break;
      }
    });
    _loadData();
  }

  void _nextPeriod() {
    setState(() {
      _customFromDate = null;
      _customToDate = null;
      switch (_currentPeriod) {
        case FilterPeriod.week:
          _referenceDate = _referenceDate.add(const Duration(days: 7));
        case FilterPeriod.month:
          _referenceDate = DateTime(_referenceDate.year, _referenceDate.month + 1, 1);
        case FilterPeriod.year:
          _referenceDate = DateTime(_referenceDate.year + 1, 1, 1);
        case FilterPeriod.all:
          break;
      }
    });
    _loadData();
  }

  void _changePeriod(FilterPeriod period) {
    setState(() {
      _currentPeriod = period;
      _referenceDate = DateTime.now();
      _customFromDate = null;
      _customToDate = null;
    });
    _loadData();
  }

  Future<void> _pickFromDate() async {
    final picked = await showDatePicker(context: context, initialDate: _startDate, firstDate: DateTime(2020), lastDate: DateTime(2099));
    if (picked != null) {
      setState(() => _customFromDate = picked);
      _loadData();
    }
  }

  Future<void> _pickToDate() async {
    final picked = await showDatePicker(context: context, initialDate: _endDate, firstDate: _customFromDate ?? DateTime(2020), lastDate: DateTime(2099));
    if (picked != null) {
      setState(() => _customToDate = DateTime(picked.year, picked.month, picked.day, 23, 59, 59));
      _loadData();
    }
  }

  // ─── Data ───────────────────────────────────────────────────────────────

  Future<void> _loadData() async {
    if (!mounted) return;
    setState(() => _isLoading = true);
    // Show ALL modules (Chi tiêu + Vàng + Nhà trọ + Shopee) — same as EXT behavior
    final results = await _repository.getByDateRange(_startDate, _endDate);
    if (!mounted) return;
    setState(() {
      _transactions = results;
      _isLoading = false;
    });
  }

  double get _totalExpense => _displayedTransactions.where((t) => t.type == 0 && !t.isDeleted).fold(0.0, (s, t) => s + t.amount);
  double get _totalIncome => _displayedTransactions.where((t) => t.type == 1 && !t.isDeleted).fold(0.0, (s, t) => s + t.amount);

  /// Transactions filtered by search query
  List<Transaction> get _displayedTransactions {
    if (_searchQuery.isEmpty) return _transactions;
    final q = _searchQuery.toLowerCase();
    return _transactions.where((t) {
      final titleMatch = t.title.toLowerCase().contains(q);
      final noteMatch = (t.note ?? '').toLowerCase().contains(q);
      return titleMatch || noteMatch;
    }).toList();
  }

  Map<DateTime, List<Transaction>> get _grouped {
    final map = <DateTime, List<Transaction>>{};
    for (final t in _displayedTransactions) {
      final key = DateTime(t.date.year, t.date.month, t.date.day);
      map.putIfAbsent(key, () => []).add(t);
    }
    return Map.fromEntries(map.entries.toList()..sort((a, b) => b.key.compareTo(a.key)));
  }

  // ─── Delete ─────────────────────────────────────────────────────────────

  Future<void> _deleteTransaction(Transaction t) async {
    await context.read<TransactionProvider>().deleteTransaction(t.id);
    _loadData();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã xóa giao dịch'), behavior: SnackBarBehavior.floating),
      );
    }
  }

  // ─── Search Suggestions ──────────────────────────────────────────────────

  void _updateSuggestions(String value) {
    final q = value.trim().toLowerCase();
    setState(() {
      _searchQuery = value.trim();
      if (q.isEmpty) {
        _searchSuggestions = [];
        return;
      }
      final seen = <String>{};
      final suggestions = <String>[];
      for (final t in _transactions) {
        if (t.title.toLowerCase().contains(q) && seen.add(t.title)) {
          suggestions.add(t.title);
        }
        final note = t.note ?? '';
        if (note.isNotEmpty && note.toLowerCase().contains(q) && seen.add(note)) {
          suggestions.add(note);
        }
      }
      _searchSuggestions = suggestions.take(6).toList();
    });
  }

  // ─── Build ──────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final canPop = Navigator.canPop(context);
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            if (_isSearching) _buildSearchBar(),
            if (_showFilter) ...[
              _buildPeriodFilter(),
              const SizedBox(height: 6),
              _buildDateRange(),
              const SizedBox(height: 10),
            ],
            _buildSummary(),
            const SizedBox(height: 4),
            Expanded(child: _buildList()),
          ],
        ),
      ),
      bottomNavigationBar: canPop ? _buildFakeBottomNav() : null,
    );
  }

  // ─── Fake Bottom Nav (when pushed from ModulesTabScreen) ────────────────

  Widget _buildFakeBottomNav() {
    const navyBlue = Color(0xFF1264F5);
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 10, offset: const Offset(0, -2))],
      ),
      child: SafeArea(
        child: SizedBox(
          height: 64,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _fakeNavItem(Icons.bar_chart_outlined, 'Dashboard', false, () => Navigator.pop(context)),
              _fakeNavItem(Icons.receipt_long, 'Chi tiêu', true, null),
              GestureDetector(
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AddTransactionScreen())).then((_) => _loadData()),
                child: Container(
                  width: 52, height: 52,
                  decoration: BoxDecoration(
                    color: navyBlue,
                    shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: navyBlue.withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 4))],
                  ),
                  child: const Icon(Icons.add, color: Colors.white, size: 26),
                ),
              ),
              _fakeNavItem(Icons.category_outlined, 'Danh mục', false, () => Navigator.pop(context)),
              _fakeNavItem(Icons.settings_outlined, 'Cài đặt', false, () => Navigator.pop(context)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _fakeNavItem(IconData icon, String label, bool isActive, VoidCallback? onTap) {
    final color = isActive ? const Color(0xFF1264F5) : Colors.grey;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 56,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(fontSize: 10, color: color, fontWeight: isActive ? FontWeight.w600 : FontWeight.normal)),
          ],
        ),
      ),
    );
  }

  // ─── Header ─────────────────────────────────────────────────────────────

  Widget _buildHeader() {
    final canPop = Navigator.canPop(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(canPop ? 4 : 20, 14, 20, 6),
      child: Row(
        children: [
          if (canPop)
            IconButton(
              icon: const Icon(Icons.arrow_back, color: _darkText),
              onPressed: () => Navigator.pop(context),
            ),
          const Expanded(
            child: Text('Chi tiêu', style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: _darkText)),
          ),
          IconButton(
            icon: Icon(_isSearching ? Icons.close : Icons.search, color: _darkText),
            onPressed: () {
              setState(() {
                _isSearching = !_isSearching;
                if (!_isSearching) {
                  _searchController.clear();
                  _searchQuery = '';
                }
              });
            },
          ),
          IconButton(
            icon: Icon(_showFilter ? Icons.tune : Icons.tune_outlined, color: _showFilter ? _primaryBlue : _darkText),
            onPressed: () => setState(() => _showFilter = !_showFilter),
          ),
        ],
      ),
    );
  }

  // ─── Search Bar ─────────────────────────────────────────────────────────

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _searchController,
            autofocus: true,
            decoration: InputDecoration(
              hintText: 'Tìm theo tên hoặc ghi chú...',
              hintStyle: TextStyle(fontSize: 14, color: Colors.grey[400]),
              prefixIcon: const Icon(Icons.search, size: 20),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _border)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _border)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _primaryBlue)),
              filled: true,
              fillColor: _bgLight,
            ),
            onChanged: _updateSuggestions,
          ),
          if (_searchSuggestions.isNotEmpty)
            Container(
              constraints: const BoxConstraints(maxHeight: 180),
              margin: const EdgeInsets.only(top: 4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: _border),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4)],
              ),
              child: ListView.builder(
                shrinkWrap: true,
                padding: EdgeInsets.zero,
                itemCount: _searchSuggestions.length,
                itemBuilder: (context, index) {
                  final s = _searchSuggestions[index];
                  return ListTile(
                    dense: true,
                    visualDensity: const VisualDensity(vertical: -2),
                    leading: Icon(Icons.history, size: 16, color: Colors.grey[400]),
                    title: Text(s, style: const TextStyle(fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                    onTap: () {
                      _searchController.text = s;
                      _searchController.selection = TextSelection.fromPosition(TextPosition(offset: s.length));
                      _updateSuggestions(s);
                    },
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

  // ─── Period Filter ──────────────────────────────────────────────────────

  Widget _buildPeriodFilter() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          _arrowBtn(Icons.chevron_left, _currentPeriod != FilterPeriod.all ? _previousPeriod : null),
          const SizedBox(width: 6),
          ...[FilterPeriod.week, FilterPeriod.month, FilterPeriod.year, FilterPeriod.all].map((p) {
            final selected = _currentPeriod == p;
            final label = switch (p) { FilterPeriod.week => 'Tuần', FilterPeriod.month => 'Tháng', FilterPeriod.year => 'Năm', FilterPeriod.all => 'Tất cả' };
            return Expanded(
              child: GestureDetector(
                onTap: () => _changePeriod(p),
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: selected ? _primaryBlue : Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: selected ? _primaryBlue : _border),
                  ),
                  child: Center(child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: selected ? Colors.white : _darkText))),
                ),
              ),
            );
          }),
          const SizedBox(width: 6),
          _arrowBtn(Icons.chevron_right, _currentPeriod != FilterPeriod.all ? _nextPeriod : null),
        ],
      ),
    );
  }

  Widget _arrowBtn(IconData icon, VoidCallback? onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(8)),
        child: Icon(icon, size: 20, color: onTap != null ? _darkText : Colors.grey[300]),
      ),
    );
  }

  // ─── Date Range (compact) ───────────────────────────────────────────────

  Widget _buildDateRange() {
    final fmt = DateFormat('dd/MM/yyyy');
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Expanded(child: _dateBox(fmt.format(_startDate), _pickFromDate)),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 10), child: Icon(Icons.arrow_forward, size: 16, color: Colors.grey[400])),
          Expanded(child: _dateBox(fmt.format(_endDate), _pickToDate)),
        ],
      ),
    );
  }

  Widget _dateBox(String text, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 38,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _border), borderRadius: BorderRadius.circular(8)),
        child: Row(
          children: [
            Expanded(child: Text(text, style: const TextStyle(fontSize: 13, color: _darkText))),
            Icon(Icons.calendar_today_outlined, size: 14, color: Colors.grey[500]),
          ],
        ),
      ),
    );
  }

  // ─── Summary ────────────────────────────────────────────────────────────

  Widget _buildSummary() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Expanded(child: _summaryCard(Icons.account_balance_wallet, const Color(0xFFFFEBEE), _red, 'Tổng chi', _totalExpense, _red)),
          const SizedBox(width: 12),
          Expanded(child: _summaryCard(Icons.arrow_circle_down, const Color(0xFFE8F5E9), _green, 'Tổng thu', _totalIncome, _green)),
        ],
      ),
    );
  }

  Widget _summaryCard(IconData icon, Color iconBg, Color iconColor, String label, double amount, Color amountColor) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: _border)),
      child: Row(
        children: [
          Container(
            width: 38, height: 38,
            decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 18, color: iconColor),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                const SizedBox(height: 2),
                Text(Formatters.currencyCompact(amount), style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: amountColor), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── Transaction List ───────────────────────────────────────────────────

  Widget _buildList() {
    if (_isLoading) return const Center(child: CircularProgressIndicator());

    final grouped = _grouped;
    if (grouped.isEmpty) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.receipt_long_outlined, size: 48, color: Colors.grey[300]),
          const SizedBox(height: 10),
          Text('Chưa có giao dịch', style: TextStyle(fontSize: 14, color: Colors.grey[500])),
        ]),
      );
    }

    final days = grouped.keys.toList();
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.only(bottom: 90),
        itemCount: days.length,
        itemBuilder: (context, i) => _buildDayGroup(days[i], grouped[days[i]]!),
      ),
    );
  }

  IconData _moduleIcon(String? moduleName) {
    switch (moduleName?.toLowerCase()) {
      case 'shopee': return Icons.shopping_cart;
      case 'vàng': return Icons.diamond;
      case 'nhà trọ': return Icons.home;
      case 'thẻ tín dụng': return Icons.credit_card;
      default: return Icons.account_balance_wallet;
    }
  }

  Widget _buildDayGroup(DateTime day, List<Transaction> txns) {
    final total = txns.where((t) => t.type != 2).fold(0.0, (s, t) => s + t.amount);
    final now = DateTime.now();
    final isToday = day.year == now.year && day.month == now.month && day.day == now.day;
    final isYesterday = day.year == now.year && day.month == now.month && day.day == now.day - 1;

    String label;
    if (isToday) {
      label = 'Hôm nay, ${DateFormat('dd/MM/yyyy').format(day)}';
    } else if (isYesterday) {
      label = 'Hôm qua, ${DateFormat('dd/MM/yyyy').format(day)}';
    } else {
      label = DateFormat('dd/MM/yyyy', 'vi').format(day);
    }

    return Column(
      children: [
        // Day header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          color: _bgLight,
          child: Row(
            children: [
              Icon(Icons.calendar_today, size: 15, color: Colors.grey[600]),
              const SizedBox(width: 8),
              Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _darkText)),
              const Spacer(),
              Text('Tổng: ${Formatters.currencyCompact(total)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _red)),
            ],
          ),
        ),
        // Transactions
        ...txns.map(_buildTxnCard),
      ],
    );
  }

  Widget _buildTxnCard(Transaction t) {
    final cat = TransactionStyles.categoryByName(t.categoryName);
    final accountColor = TransactionStyles.accountColorByName(t.accountName);
    final accountIcon = TransactionStyles.accountIconByName(t.accountName);
    final moduleColor = TransactionStyles.moduleColorByName(t.moduleName);

    return Dismissible(
      key: Key(t.id),
      direction: DismissDirection.endToStart,
      confirmDismiss: (direction) async {
        return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Xóa giao dịch'),
            content: Text('Bạn có chắc muốn xóa "${t.title}"?'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                style: FilledButton.styleFrom(backgroundColor: Colors.red),
                child: const Text('Xóa'),
              ),
            ],
          ),
        );
      },
      onDismissed: (direction) => _deleteTransaction(t),
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: Colors.red,
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      child: InkWell(
        onTap: () {
          Navigator.push(context, MaterialPageRoute(builder: (_) => TransactionDetailScreen(transaction: t))).then((_) => _loadData());
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(color: Colors.white, border: Border(bottom: BorderSide(color: Colors.grey[100]!))),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Category icon
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(color: cat.bgColor, borderRadius: BorderRadius.circular(10)),
                child: Icon(cat.icon, size: 20, color: cat.color),
              ),
              const SizedBox(width: 12),
              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Row 1: title
                    Text(t.title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _darkText), maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 4),
                    // Row 2: payment + module
                    Row(
                      children: [
                        Icon(accountIcon, size: 14, color: accountColor),
                        const SizedBox(width: 4),
                        Flexible(child: Text(t.accountName ?? '', style: TextStyle(fontSize: 12, color: accountColor), maxLines: 1, overflow: TextOverflow.ellipsis)),
                        Padding(padding: const EdgeInsets.symmetric(horizontal: 6), child: Text('|', style: TextStyle(fontSize: 12, color: Colors.grey[300]))),
                        Icon(_moduleIcon(t.moduleName), size: 15, color: moduleColor),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              // Amount
              Text(Formatters.currency(t.amount), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: t.type == 0 ? _darkText : _green)),
            ],
          ),
        ),
      ),
    );
  }
}
