import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../models/transaction.dart';
import '../../../providers/transaction_provider.dart';
import '../../../screens/transactions/add_transaction_screen.dart';
import '../../../screens/transactions/transaction_detail_screen.dart';

enum _FilterPeriod { week, month, year, all }

class ShopeeHomeScreen extends StatefulWidget {
  /// This screen doubles as the generic module screen. When opened for a custom
  /// module, pass its id/title/icon/color; defaults keep the original Shopee UI.
  final String moduleId;
  final String title;
  final String subtitle;
  final IconData headerIcon;
  final Color accentColor;

  const ShopeeHomeScreen({
    super.key,
    this.moduleId = 'mod_shopee',
    this.title = 'Mua sắm online',
    this.subtitle = 'Chi tiêu mua sắm trên các sàn TMĐT',
    this.headerIcon = Icons.shopping_bag,
    this.accentColor = const Color(0xFFFF2D16),
  });

  @override
  State<ShopeeHomeScreen> createState() => _ShopeeHomeScreenState();
}

class _ShopeeHomeScreenState extends State<ShopeeHomeScreen> {
  // ─── Colors ─────────────────────────────────────────────────────────────
  // Accent color comes from the module (defaults to Shopee red).
  Color get _primaryRed => widget.accentColor;
  static const _navy = Color(0xFF101B4D);
  static const _blue = Color(0xFF1264F5);
  static const _green = Color(0xFF16A34A);
  static const _purple = Color(0xFF6D28D9);
  static const _border = Color(0xFFE5E7EB);
  static const _lightBg = Color(0xFFFFF7F5);

  // ─── State ──────────────────────────────────────────────────────────────
  _FilterPeriod _currentPeriod = _FilterPeriod.month;
  DateTime _referenceDate = DateTime.now();
  DateTime? _customFromDate;
  DateTime? _customToDate;
  List<Transaction> _transactions = [];
  bool _isLoading = false;
  String _selectedPlatform = 'all'; // all, shopee, tiktok

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

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // ─── Date Range Logic (reused from ExpenseScreen) ───────────────────────

  DateTime get _startDate {
    if (_customFromDate != null) return _customFromDate!;
    switch (_currentPeriod) {
      case _FilterPeriod.week:
        final weekday = _referenceDate.weekday;
        return DateTime(_referenceDate.year, _referenceDate.month, _referenceDate.day - (weekday - 1));
      case _FilterPeriod.month:
        return DateTime(_referenceDate.year, _referenceDate.month, 1);
      case _FilterPeriod.year:
        return DateTime(_referenceDate.year, 1, 1);
      case _FilterPeriod.all:
        return DateTime(2020, 1, 1);
    }
  }

  DateTime get _endDate {
    if (_customToDate != null) return _customToDate!;
    switch (_currentPeriod) {
      case _FilterPeriod.week:
        final weekday = _referenceDate.weekday;
        final weekStart = DateTime(_referenceDate.year, _referenceDate.month, _referenceDate.day - (weekday - 1));
        return weekStart.add(const Duration(days: 7)).subtract(const Duration(milliseconds: 1));
      case _FilterPeriod.month:
        return DateTime(_referenceDate.year, _referenceDate.month + 1, 1).subtract(const Duration(milliseconds: 1));
      case _FilterPeriod.year:
        return DateTime(_referenceDate.year + 1, 1, 1).subtract(const Duration(milliseconds: 1));
      case _FilterPeriod.all:
        return DateTime(2099, 12, 31, 23, 59, 59);
    }
  }

  void _previousPeriod() {
    setState(() {
      _customFromDate = null;
      _customToDate = null;
      switch (_currentPeriod) {
        case _FilterPeriod.week:
          _referenceDate = _referenceDate.subtract(const Duration(days: 7));
        case _FilterPeriod.month:
          _referenceDate = DateTime(_referenceDate.year, _referenceDate.month - 1, 1);
        case _FilterPeriod.year:
          _referenceDate = DateTime(_referenceDate.year - 1, 1, 1);
        case _FilterPeriod.all:
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
        case _FilterPeriod.week:
          _referenceDate = _referenceDate.add(const Duration(days: 7));
        case _FilterPeriod.month:
          _referenceDate = DateTime(_referenceDate.year, _referenceDate.month + 1, 1);
        case _FilterPeriod.year:
          _referenceDate = DateTime(_referenceDate.year + 1, 1, 1);
        case _FilterPeriod.all:
          break;
      }
    });
    _loadData();
  }

  void _changePeriod(_FilterPeriod period) {
    setState(() {
      _currentPeriod = period;
      _referenceDate = DateTime.now();
      _customFromDate = null;
      _customToDate = null;
    });
    _loadData();
  }

  Future<void> _pickFromDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2099),
    );
    if (picked != null) {
      setState(() => _customFromDate = picked);
      _loadData();
    }
  }

  Future<void> _pickToDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _endDate.isBefore(DateTime(2099)) ? _endDate : DateTime.now(),
      firstDate: _customFromDate ?? DateTime(2020),
      lastDate: DateTime(2099),
    );
    if (picked != null) {
      setState(() => _customToDate = DateTime(picked.year, picked.month, picked.day, 23, 59, 59));
      _loadData();
    }
  }

  // ─── Data Loading ───────────────────────────────────────────────────────

  Future<void> _loadData() async {
    if (!mounted) return;
    setState(() => _isLoading = true);
    final provider = context.read<TransactionProvider>();
    final results = await provider.search(
      moduleId: widget.moduleId,
      startDate: _startDate,
      endDate: _endDate,
    );
    if (!mounted) return;
    setState(() {
      _transactions = results.where((t) => !t.isDeleted).toList();
      _isLoading = false;
    });
  }

  // ─── Computed Data ──────────────────────────────────────────────────────

  List<Transaction> get _filteredTransactions {
    List<Transaction> result = _transactions;
    // Filter by platform
    if (_selectedPlatform != 'all') {
      result = result.where((t) {
        final store = (t.store ?? '').toLowerCase();
        if (_selectedPlatform == 'shopee') return store.contains('shopee');
        if (_selectedPlatform == 'tiktok') return store.contains('tiktok');
        return true;
      }).toList();
    }
    // Filter by search query
    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      result = result.where((t) {
        final titleMatch = t.title.toLowerCase().contains(q);
        final noteMatch = (t.note ?? '').toLowerCase().contains(q);
        return titleMatch || noteMatch;
      }).toList();
    }
    return result;
  }

  double get _totalExpense => _filteredTransactions.where((t) => t.isExpense).fold(0.0, (s, t) => s + t.amount);
  int get _orderCount => _filteredTransactions.length;

  /// Find the day with the most spending
  MapEntry<DateTime, _DaySummary>? get _topDay {
    final dayMap = <DateTime, _DaySummary>{};
    for (final t in _filteredTransactions) {
      final key = DateTime(t.date.year, t.date.month, t.date.day);
      dayMap.putIfAbsent(key, () => _DaySummary());
      dayMap[key]!.total += t.amount;
      dayMap[key]!.count++;
    }
    if (dayMap.isEmpty) return null;
    final sorted = dayMap.entries.toList()..sort((a, b) => b.value.total.compareTo(a.value.total));
    return sorted.first;
  }

  Map<DateTime, List<Transaction>> get _grouped {
    final map = <DateTime, List<Transaction>>{};
    for (final t in _filteredTransactions) {
      final key = DateTime(t.date.year, t.date.month, t.date.day);
      map.putIfAbsent(key, () => []).add(t);
    }
    return Map.fromEntries(map.entries.toList()..sort((a, b) => b.key.compareTo(a.key)));
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

  // ─── Actions ────────────────────────────────────────────────────────────

  void _onTopDayTap() {
    final top = _topDay;
    if (top == null) return;
    setState(() {
      _customFromDate = top.key;
      _customToDate = DateTime(top.key.year, top.key.month, top.key.day, 23, 59, 59);
    });
    _loadData();
  }

  void _addTransaction() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => AddTransactionScreen(preSelectedModuleId: widget.moduleId),
      ),
    ).then((result) {
      if (result == true) _loadData();
    });
  }

  void _openDetail(Transaction t) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => TransactionDetailScreen(transaction: t)),
    ).then((result) {
      if (result == true) _loadData();
    });
  }

  // ─── Build ──────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : RefreshIndicator(
                      onRefresh: _loadData,
                      child: SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        child: Column(
                          children: [
                            if (_isSearching) _buildSearchBar(),
                            if (_showFilter) ...[
                              _buildPeriodFilter(),
                              const SizedBox(height: 8),
                              _buildDateRange(),
                              const SizedBox(height: 12),
                            ],
                            _buildStats(),
                            const SizedBox(height: 12),
                            // Platform menu hidden - logic preserved for future use
                            // _buildPlatformMenu(),
                            _buildTransactionListHeader(),
                            _buildTransactionList(),
                            const SizedBox(height: 80),
                          ],
                        ),
                      ),
                    ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  // ─── Header ─────────────────────────────────────────────────────────────

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(4, 8, 4, 8),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: _navy),
            onPressed: () => Navigator.pop(context),
          ),
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: _lightBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(widget.headerIcon, color: _primaryRed, size: 22),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.title,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _navy),
                ),
                Text(
                  widget.subtitle,
                  style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(_isSearching ? Icons.close : Icons.search, color: _navy),
            onPressed: () {
              setState(() {
                _isSearching = !_isSearching;
                if (!_isSearching) {
                  _searchController.clear();
                  _searchQuery = '';
                  _searchSuggestions = [];
                }
              });
            },
          ),
          IconButton(
            icon: Icon(_showFilter ? Icons.tune : Icons.tune_outlined, color: _showFilter ? _primaryRed : _navy),
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
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _border)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _border)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _primaryRed)),
              filled: true,
              fillColor: _lightBg,
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
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: [
          _arrowBtn(Icons.chevron_left, _currentPeriod != _FilterPeriod.all ? _previousPeriod : null),
          const SizedBox(width: 4),
          ...[_FilterPeriod.week, _FilterPeriod.month, _FilterPeriod.year, _FilterPeriod.all].map((p) {
            final selected = _currentPeriod == p;
            final label = switch (p) {
              _FilterPeriod.week => 'Tuần',
              _FilterPeriod.month => 'Tháng',
              _FilterPeriod.year => 'Năm',
              _FilterPeriod.all => 'Tất cả',
            };
            return Expanded(
              child: GestureDetector(
                onTap: () => _changePeriod(p),
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  decoration: BoxDecoration(
                    color: selected ? _primaryRed : Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: selected ? _primaryRed : _border),
                  ),
                  child: Center(
                    child: Text(
                      label,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: selected ? Colors.white : _navy,
                      ),
                    ),
                  ),
                ),
              ),
            );
          }),
          const SizedBox(width: 4),
          _arrowBtn(Icons.chevron_right, _currentPeriod != _FilterPeriod.all ? _nextPeriod : null),
        ],
      ),
    );
  }

  Widget _arrowBtn(IconData icon, VoidCallback? onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: _border),
        ),
        child: Icon(icon, size: 20, color: onTap != null ? _navy : Colors.grey[300]),
      ),
    );
  }

  // ─── Date Range ─────────────────────────────────────────────────────────

  Widget _buildDateRange() {
    final df = DateFormat('dd/MM/yyyy');
    final fromText = df.format(_startDate);
    final toText = df.format(_endDate.isBefore(DateTime(2099)) ? _endDate : DateTime.now());

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: _pickFromDate,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                decoration: BoxDecoration(
                  border: Border.all(color: _border),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]),
                    const SizedBox(width: 8),
                    Text(fromText, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 8),
            child: Text('-', style: TextStyle(fontSize: 16, color: Colors.grey)),
          ),
          Expanded(
            child: GestureDetector(
              onTap: _pickToDate,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                decoration: BoxDecoration(
                  border: Border.all(color: _border),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]),
                    const SizedBox(width: 8),
                    Text(toText, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Stats ──────────────────────────────────────────────────────────────

  Widget _buildStats() {
    final top = _topDay;
    final df = DateFormat('dd/MM/yyyy');

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _border.withOpacity(0.5)),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 6, offset: const Offset(0, 2)),
          ],
        ),
        child: Row(
          children: [
            // Tổng chi
            Expanded(
              child: _StatCard(
                icon: Icons.shopping_bag_outlined,
                iconBgColor: _primaryRed.withOpacity(0.1),
                iconColor: _primaryRed,
                label: 'Tổng chi',
                value: _formatShortCurrency(_totalExpense),
                valueColor: _primaryRed,
                subtitle: '$_orderCount giao dịch',
              ),
            ),
            Container(width: 1, height: 50, color: _border.withOpacity(0.5)),
            // Đơn hàng (Shopee) / Giao dịch (module khác)
            Expanded(
              child: _StatCard(
                icon: Icons.inventory_2_outlined,
                iconBgColor: _blue.withOpacity(0.1),
                iconColor: _blue,
                label: widget.moduleId == 'mod_shopee' ? 'Đơn hàng' : 'Giao dịch',
                value: '$_orderCount',
                valueColor: _blue,
                subtitle: widget.moduleId == 'mod_shopee' ? '$_orderCount đơn' : '$_orderCount giao dịch',
              ),
            ),
            Container(width: 1, height: 50, color: _border.withOpacity(0.5)),
            // Ngày mua nhiều nhất
            Expanded(
              child: GestureDetector(
                onTap: _onTopDayTap,
                child: _StatCard(
                  icon: Icons.calendar_month_outlined,
                  iconBgColor: _purple.withOpacity(0.1),
                  iconColor: _purple,
                  label: 'Ngày mua nhiều nhất',
                  value: top != null ? df.format(top.key) : '--',
                  valueColor: _purple,
                  subtitle: top != null
                      ? '${_formatShortCurrency(top.value.total)} (${top.value.count} đơn)'
                      : '',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatShortCurrency(double amount) {
    if (amount >= 1000000) {
      return '${(amount / 1000000).toStringAsFixed(1)}tr đ';
    }
    final formatted = NumberFormat('#,###', 'vi_VN').format(amount.toInt());
    return '$formatted đ';
  }

  // ─── Platform Menu ──────────────────────────────────────────────────────

  Widget _buildPlatformMenu() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          _platformChip('all', 'Tất cả', Icons.grid_view_rounded, _primaryRed),
          const SizedBox(width: 10),
          _platformChip('shopee', 'Shopee', Icons.store, Colors.orange[700]!),
          const SizedBox(width: 10),
          _platformChip('tiktok', 'TikTok Shop', Icons.music_note, Colors.black87),
          const SizedBox(width: 10),
          _platformChip('more', 'Thêm', Icons.add, Colors.grey[600]!),
        ],
      ),
    );
  }

  Widget _platformChip(String key, String label, IconData icon, Color color) {
    final isSelected = _selectedPlatform == key;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          if (key == 'more') {
            _showMorePlatforms();
            return;
          }
          setState(() => _selectedPlatform = key);
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? _primaryRed.withOpacity(0.08) : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isSelected ? _primaryRed.withOpacity(0.3) : _border),
          ),
          child: Column(
            children: [
              Icon(icon, size: 22, color: isSelected ? _primaryRed : color),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color: isSelected ? _primaryRed : _navy,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showMorePlatforms() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Chọn sàn TMĐT', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
            ListTile(leading: const Icon(Icons.store, color: Colors.orange), title: const Text('Shopee'), onTap: () { setState(() => _selectedPlatform = 'shopee'); Navigator.pop(ctx); }),
            ListTile(leading: const Icon(Icons.music_note, color: Colors.black87), title: const Text('TikTok Shop'), onTap: () { setState(() => _selectedPlatform = 'tiktok'); Navigator.pop(ctx); }),
            ListTile(leading: Icon(Icons.store, color: Colors.blue[700]), title: const Text('Lazada'), onTap: () { Navigator.pop(ctx); }),
            ListTile(leading: Icon(Icons.store, color: Colors.blue[900]), title: const Text('Tiki'), onTap: () { Navigator.pop(ctx); }),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  // ─── Transaction List Header ────────────────────────────────────────────

  Widget _buildTransactionListHeader() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: _primaryRed,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(8),
          topRight: Radius.circular(8),
        ),
      ),
      child: const Row(
        children: [
          Expanded(
            flex: 3,
            child: Text('GIAO DỊCH', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white)),
          ),
          Expanded(
            flex: 2,
            child: Text('CỦA', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white), textAlign: TextAlign.center),
          ),
          Expanded(
            flex: 2,
            child: Text('SỐ TIỀN', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white), textAlign: TextAlign.right),
          ),
        ],
      ),
    );
  }

  // ─── Transaction List ───────────────────────────────────────────────────

  Widget _buildTransactionList() {
    final grouped = _grouped;
    if (grouped.isEmpty) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16),
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          border: Border.all(color: _border),
          borderRadius: const BorderRadius.only(
            bottomLeft: Radius.circular(8),
            bottomRight: Radius.circular(8),
          ),
        ),
        child: Center(
          child: Column(
            children: [
              Icon(Icons.shopping_bag_outlined, size: 48, color: Colors.grey[300]),
              const SizedBox(height: 8),
              Text('Chưa có giao dịch', style: TextStyle(color: Colors.grey[500])),
            ],
          ),
        ),
      );
    }

    final df = DateFormat('dd/MM/yyyy');
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        border: Border.all(color: _border),
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(8),
          bottomRight: Radius.circular(8),
        ),
      ),
      child: Column(
        children: grouped.entries.map((entry) {
          final date = entry.key;
          final transactions = entry.value;
          final dayTotal = transactions.fold(0.0, (sum, t) => sum + (t.isExpense ? t.amount : -t.amount));
          return Column(
            children: [
              // Day header
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                color: _lightBg,
                child: Row(
                  children: [
                    Icon(Icons.calendar_today, size: 13, color: _primaryRed.withOpacity(0.8)),
                    const SizedBox(width: 6),
                    Text(
                      df.format(date),
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _primaryRed.withOpacity(0.9)),
                    ),
                    const Spacer(),
                    Text(
                      'Tổng: ${_formatShortCurrency(dayTotal.abs())}',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Colors.grey[600]),
                    ),
                  ],
                ),
              ),
              // Transactions for this day
              ...transactions.map((t) => _buildTransactionItem(t)),
            ],
          );
        }).toList(),
      ),
    );
  }

  Widget _buildTransactionItem(Transaction t) {
    final isNegative = t.isIncome; // income in shopee context = refund
    final amountText = isNegative
        ? '-${_formatShortCurrency(t.amount)}'
        : _formatShortCurrency(t.amount);
    final amountColor = isNegative ? _green : Colors.black87;
    final beneficiary = t.beneficiary ?? '';

    return Dismissible(
      key: Key(t.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: Colors.red,
        child: const Icon(Icons.delete, color: Colors.white),
      ),
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
      onDismissed: (direction) async {
        await context.read<TransactionProvider>().deleteTransaction(t.id);
        _loadData();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Đã xóa giao dịch'), behavior: SnackBarBehavior.floating),
          );
        }
      },
      child: InkWell(
        onTap: () => _openDetail(t),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: _border.withOpacity(0.5))),
          ),
          child: Row(
            children: [
              // Tên giao dịch
              Expanded(
                flex: 3,
                child: Text(
                  t.title,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.black87),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              // Người nhận (Của)
              Expanded(
                flex: 2,
                child: Text(
                  beneficiary,
                  style: TextStyle(fontSize: 12, color: Colors.grey[700]),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              // Số tiền
              Expanded(
                flex: 2,
                child: Text(
                  amountText,
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: amountColor),
                  textAlign: TextAlign.right,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Bottom Navigation ──────────────────────────────────────────────────

  Widget _buildBottomNav() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 10, offset: const Offset(0, -2)),
        ],
      ),
      child: SafeArea(
        child: SizedBox(
          height: 64,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _navItem(Icons.bar_chart_outlined, 'Dashboard', false, () => Navigator.pop(context)),
              _navItem(Icons.receipt_long_outlined, 'Chi tiêu', false, () => Navigator.pop(context)),
              // FAB
              GestureDetector(
                onTap: _addTransaction,
                child: Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: _primaryRed,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(color: _primaryRed.withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 4)),
                    ],
                  ),
                  child: const Icon(Icons.add, color: Colors.white, size: 26),
                ),
              ),
              _navItem(Icons.category, 'Danh mục', true, null),
              _navItem(Icons.settings_outlined, 'Cài đặt', false, () => Navigator.pop(context)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _navItem(IconData icon, String label, bool isActive, VoidCallback? onTap) {
    final color = isActive ? _primaryRed : Colors.grey;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 60,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 3),
            Text(label, style: TextStyle(fontSize: 10, color: color, fontWeight: isActive ? FontWeight.w600 : FontWeight.normal)),
          ],
        ),
      ),
    );
  }
}

// ─── Helper Classes ─────────────────────────────────────────────────────────

class _DaySummary {
  double total = 0;
  int count = 0;
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final Color iconBgColor;
  final Color iconColor;
  final String label;
  final String value;
  final Color valueColor;
  final String subtitle;

  const _StatCard({
    required this.icon,
    required this.iconBgColor,
    required this.iconColor,
    required this.label,
    required this.value,
    required this.valueColor,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Column(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(color: iconBgColor, borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, size: 16, color: iconColor),
          ),
          const SizedBox(height: 6),
          Text(label, style: TextStyle(fontSize: 9, color: Colors.grey[600]), textAlign: TextAlign.center),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: valueColor),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: 1),
            Text(subtitle, style: TextStyle(fontSize: 9, color: Colors.grey[500]), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
          ],
        ],
      ),
    );
  }
}
