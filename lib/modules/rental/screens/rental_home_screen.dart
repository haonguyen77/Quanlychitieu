import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../models/transaction.dart';
import '../../../providers/transaction_provider.dart';
import '../../../screens/transactions/add_transaction_screen.dart';
import '../../../screens/transactions/transaction_detail_screen.dart';

enum _FilterPeriod { month, year, all }

class RentalHomeScreen extends StatefulWidget {
  const RentalHomeScreen({super.key});

  @override
  State<RentalHomeScreen> createState() => _RentalHomeScreenState();
}

class _RentalHomeScreenState extends State<RentalHomeScreen> {
  // ─── Colors ─────────────────────────────────────────────────────────────
  static const _primaryGreen = Color(0xFF16A34A);
  static const _navy = Color(0xFF101B4D);
  static const _border = Color(0xFFE5E7EB);
  static const _lightBg = Color(0xFFF0FDF4);

  // ─── State ──────────────────────────────────────────────────────────────
  _FilterPeriod _currentPeriod = _FilterPeriod.year;
  DateTime _referenceDate = DateTime.now();
  DateTime? _customFromDate;
  DateTime? _customToDate;
  List<Transaction> _transactions = [];
  bool _isLoading = false;

  // Search
  bool _isSearching = false;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  List<String> _searchSuggestions = [];

  // Filter visibility (default: hidden)
  bool _showFilter = false;

  // Expand/Collapse
  bool _isExpanded = true;

  // Config
  int _dueDay = 29;
  int _alertDays = 5;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadConfig();
      _loadData();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadConfig() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _dueDay = prefs.getInt('rental_due_day') ?? 29;
      _alertDays = prefs.getInt('rental_alert_days') ?? 5;
    });
  }

  Future<void> _saveConfig() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('rental_due_day', _dueDay);
    await prefs.setInt('rental_alert_days', _alertDays);
  }

  // ─── Date Range Logic ───────────────────────────────────────────────────

  DateTime get _startDate {
    if (_customFromDate != null) return _customFromDate!;
    switch (_currentPeriod) {
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
    final picked = await showDatePicker(context: context, initialDate: _startDate, firstDate: DateTime(2020), lastDate: DateTime(2099));
    if (picked != null) {
      setState(() => _customFromDate = picked);
      _loadData();
    }
  }

  Future<void> _pickToDate() async {
    final picked = await showDatePicker(context: context, initialDate: _endDate.isBefore(DateTime(2099)) ? _endDate : DateTime.now(), firstDate: _customFromDate ?? DateTime(2020), lastDate: DateTime(2099));
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
      moduleId: 'mod_nhatro',
      startDate: _startDate,
      endDate: _endDate,
    );
    if (!mounted) return;
    setState(() {
      _transactions = results.where((t) => !t.isDeleted).toList()
        ..sort((a, b) => b.date.compareTo(a.date));
      _isLoading = false;
    });
  }

  // ─── Computed ───────────────────────────────────────────────────────────

  List<Transaction> get _displayedTransactions {
    if (_searchQuery.isEmpty) return _transactions;
    final q = _searchQuery.toLowerCase();
    return _transactions.where((t) {
      final titleMatch = t.title.toLowerCase().contains(q);
      final noteMatch = (t.note ?? '').toLowerCase().contains(q);
      return titleMatch || noteMatch;
    }).toList();
  }

  /// Next due date
  DateTime get _nextDueDate {
    final now = DateTime.now();
    var due = DateTime(now.year, now.month, _dueDay);
    if (due.isBefore(now) || due.isAtSameMomentAs(now)) {
      due = DateTime(now.year, now.month + 1, _dueDay);
    }
    return due;
  }

  // ─── Search Suggestions ─────────────────────────────────────────────────

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
        // Người thuê = title
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

  void _addTransaction() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const AddTransactionScreen(preSelectedModuleId: 'mod_nhatro')),
    ).then((result) {
      if (result == true) _loadData();
    });
  }

  void _openEdit(Transaction t) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => TransactionDetailScreen(transaction: t)),
    ).then((result) {
      if (result == true) _loadData();
    });
  }

  Future<void> _editDueDay() async {
    final controller = TextEditingController(text: '$_dueDay');
    final result = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Ngày đóng tiền'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(hintText: 'Nhập ngày (1-31)', border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          FilledButton(
            onPressed: () {
              final val = int.tryParse(controller.text) ?? 0;
              if (val >= 1 && val <= 31) Navigator.pop(ctx, val);
            },
            child: const Text('Lưu'),
          ),
        ],
      ),
    );
    if (result != null) {
      setState(() => _dueDay = result);
      _saveConfig();
    }
  }

  Future<void> _editAlertDays() async {
    final controller = TextEditingController(text: '$_alertDays');
    final result = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cảnh báo trước'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(hintText: 'Số ngày cảnh báo trước', border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          FilledButton(
            onPressed: () {
              final val = int.tryParse(controller.text) ?? 0;
              if (val >= 1 && val <= 30) Navigator.pop(ctx, val);
            },
            child: const Text('Lưu'),
          ),
        ],
      ),
    );
    if (result != null) {
      setState(() => _alertDays = result);
      _saveConfig();
    }
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
                              const SizedBox(height: 6),
                              _buildDateRange(),
                              const SizedBox(height: 10),
                            ],
                            _buildInfoCards(),
                            const SizedBox(height: 8),
                            _buildExpandToggle(),
                            const SizedBox(height: 4),
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
          IconButton(icon: const Icon(Icons.arrow_back, color: _navy), onPressed: () => Navigator.pop(context)),
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(color: _lightBg, borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.home_outlined, color: _primaryGreen, size: 22),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Nhà trọ', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _navy)),
                Text('Quản lý nhà trọ, thu tiền hàng tháng', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ],
            ),
          ),
          IconButton(
            icon: Icon(_isSearching ? Icons.close : Icons.search, color: _navy),
            onPressed: () {
              setState(() {
                _isSearching = !_isSearching;
                if (!_isSearching) { _searchController.clear(); _searchQuery = ''; _searchSuggestions = []; }
              });
            },
          ),
          IconButton(
            icon: Icon(_showFilter ? Icons.tune : Icons.tune_outlined, color: _showFilter ? _primaryGreen : _navy),
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
              hintText: 'Tìm theo người thuê hoặc ghi chú...',
              hintStyle: TextStyle(fontSize: 14, color: Colors.grey[400]),
              prefixIcon: const Icon(Icons.search, size: 20),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _border)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _border)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _primaryGreen)),
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
                color: Colors.white, borderRadius: BorderRadius.circular(8),
                border: Border.all(color: _border),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4)],
              ),
              child: ListView.builder(
                shrinkWrap: true, padding: EdgeInsets.zero,
                itemCount: _searchSuggestions.length,
                itemBuilder: (context, index) {
                  final s = _searchSuggestions[index];
                  return ListTile(
                    dense: true, visualDensity: const VisualDensity(vertical: -2),
                    leading: Icon(Icons.history, size: 16, color: Colors.grey[400]),
                    title: Text(s, style: const TextStyle(fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                    onTap: () { _searchController.text = s; _searchController.selection = TextSelection.fromPosition(TextPosition(offset: s.length)); _updateSuggestions(s); },
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
          ...[_FilterPeriod.month, _FilterPeriod.year, _FilterPeriod.all].map((p) {
            final selected = _currentPeriod == p;
            final label = switch (p) { _FilterPeriod.month => 'Tháng', _FilterPeriod.year => 'Năm', _FilterPeriod.all => 'Tất cả' };
            return Expanded(
              child: GestureDetector(
                onTap: () => _changePeriod(p),
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  decoration: BoxDecoration(color: selected ? _primaryGreen : Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: selected ? _primaryGreen : _border)),
                  child: Center(child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: selected ? Colors.white : _navy))),
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
        width: 36, height: 36,
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: _border)),
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
                decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(8)),
                child: Row(children: [
                  Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]),
                  const SizedBox(width: 8),
                  Text(fromText, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                ]),
              ),
            ),
          ),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 8), child: Icon(Icons.arrow_forward, size: 16, color: Colors.grey[400])),
          Expanded(
            child: GestureDetector(
              onTap: _pickToDate,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(8)),
                child: Row(children: [
                  Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]),
                  const SizedBox(width: 8),
                  Text(toText, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                ]),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Info Cards ─────────────────────────────────────────────────────────

  Widget _buildInfoCards() {
    final df = DateFormat('dd/MM/yyyy');
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          // Ngày đóng tiền
          Expanded(
            child: GestureDetector(
              onTap: _editDueDay,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: _border)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Icon(Icons.calendar_month, size: 16, color: Colors.purple[400]),
                      const SizedBox(width: 6),
                      Text('Ngày đóng tiền', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                    ]),
                    const SizedBox(height: 6),
                    Text(df.format(_nextDueDate), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _primaryGreen)),
                    const SizedBox(height: 4),
                    Text('Ngày thu tiền tiếp theo', style: TextStyle(fontSize: 10, color: Colors.grey[500])),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          // Cảnh báo
          Expanded(
            child: GestureDetector(
              onTap: _editAlertDays,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: _border)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Icon(Icons.notifications_outlined, size: 16, color: Colors.orange[600]),
                      const SizedBox(width: 6),
                      Text('Cảnh báo', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                    ]),
                    const SizedBox(height: 6),
                    Text('$_alertDays ngày', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _primaryGreen)),
                    const SizedBox(height: 4),
                    Text('Cảnh báo trước ngày đóng tiền', style: TextStyle(fontSize: 10, color: Colors.grey[500])),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Expand Toggle ──────────────────────────────────────────────────────

  Widget _buildExpandToggle() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Align(
        alignment: Alignment.centerRight,
        child: GestureDetector(
          onTap: () => setState(() => _isExpanded = !_isExpanded),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(_isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down, size: 18, color: _primaryGreen),
              const SizedBox(width: 4),
              Text(_isExpanded ? 'Thu gọn' : 'Mở rộng', style: const TextStyle(fontSize: 12, color: _primaryGreen, fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Transaction List Header ────────────────────────────────────────────

  Widget _buildTransactionListHeader() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: const BoxDecoration(
        color: _primaryGreen,
        borderRadius: BorderRadius.only(topLeft: Radius.circular(8), topRight: Radius.circular(8)),
      ),
      child: const Row(
        children: [
          SizedBox(width: 60, child: Text('THÁNG', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white))),
          Expanded(child: Text('NGƯỜI THUÊ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white))),
          Text('SỐ TIỀN', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
        ],
      ),
    );
  }

  // ─── Transaction List ───────────────────────────────────────────────────

  Widget _buildTransactionList() {
    final txns = _displayedTransactions;
    if (txns.isEmpty) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16),
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: const BorderRadius.only(bottomLeft: Radius.circular(8), bottomRight: Radius.circular(8))),
        child: Center(
          child: Column(children: [
            Icon(Icons.home_outlined, size: 48, color: Colors.grey[300]),
            const SizedBox(height: 8),
            Text('Chưa có giao dịch nhà trọ', style: TextStyle(color: Colors.grey[500])),
          ]),
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: const BorderRadius.only(bottomLeft: Radius.circular(8), bottomRight: Radius.circular(8))),
      child: Column(children: txns.map((t) => _buildTransactionItem(t)).toList()),
    );
  }

  Widget _buildTransactionItem(Transaction t) {
    final df = DateFormat('dd/MM/yyyy');
    final mf = DateFormat('MM/yyyy');
    final amountFormatted = '${NumberFormat('#,###', 'vi_VN').format(t.amount.toInt())} đ';
    final note = t.note?.isNotEmpty == true ? t.note! : '—';

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
              FilledButton(onPressed: () => Navigator.pop(ctx, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('Xóa')),
            ],
          ),
        );
      },
      onDismissed: (direction) async {
        await context.read<TransactionProvider>().deleteTransaction(t.id);
        _loadData();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Đã xóa giao dịch'), behavior: SnackBarBehavior.floating));
        }
      },
      child: InkWell(
        onTap: () => _openEdit(t),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: _border.withOpacity(0.5)))),
          child: Column(
            children: [
              // Row: Tháng | Người thuê | Số tiền | expand icon
              Row(
                children: [
                  SizedBox(width: 60, child: Text(mf.format(t.date), style: const TextStyle(fontSize: 13, color: _navy))),
                  Expanded(child: Text(t.title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _navy))),
                  Text(amountFormatted, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _navy)),
                  const SizedBox(width: 4),
                  Icon(_isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down, size: 18, color: Colors.grey[400]),
                ],
              ),
              // Expanded detail: Ngày đóng tiền + Ghi chú
              if (_isExpanded) ...[
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            Icon(Icons.calendar_today, size: 12, color: Colors.grey[500]),
                            const SizedBox(width: 4),
                            Text('Ngày đóng tiền', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                          ]),
                          const SizedBox(height: 3),
                          Text(df.format(t.date), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _navy)),
                        ],
                      ),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            Icon(Icons.note_outlined, size: 12, color: Colors.grey[500]),
                            const SizedBox(width: 4),
                            Text('Ghi chú', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                          ]),
                          const SizedBox(height: 3),
                          Text(note, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: _navy)),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _detailItem(IconData icon, Color iconColor, String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Icon(icon, size: 12, color: iconColor),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 9, color: Colors.grey[500])),
        ]),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: _navy), maxLines: 1, overflow: TextOverflow.ellipsis),
      ],
    );
  }

  // ─── Bottom Navigation ──────────────────────────────────────────────────

  Widget _buildBottomNav() {
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
              _navItem(Icons.bar_chart_outlined, 'Dashboard', false, () => Navigator.pop(context)),
              _navItem(Icons.receipt_long_outlined, 'Chi tiêu', false, () => Navigator.pop(context)),
              GestureDetector(
                onTap: _addTransaction,
                child: Container(
                  width: 52, height: 52,
                  decoration: BoxDecoration(
                    color: _primaryGreen, shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: _primaryGreen.withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 4))],
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
    final color = isActive ? _primaryGreen : Colors.grey;
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
