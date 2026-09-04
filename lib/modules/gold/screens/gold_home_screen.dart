import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../models/transaction.dart';
import '../../../providers/transaction_provider.dart';
import '../../../screens/transactions/add_transaction_screen.dart';
import '../../../screens/transactions/transaction_detail_screen.dart';

enum _FilterPeriod { month, year, all }

class GoldHomeScreen extends StatefulWidget {
  const GoldHomeScreen({super.key});

  @override
  State<GoldHomeScreen> createState() => _GoldHomeScreenState();
}

class _GoldHomeScreenState extends State<GoldHomeScreen> {
  // ─── Colors ─────────────────────────────────────────────────────────────
  static const _primaryGold = Color(0xFFF59E0B);
  static const _darkGold = Color(0xFFD97706);
  static const _navy = Color(0xFF101B4D);
  static const _green = Color(0xFF16A34A);
  static const _red = Color(0xFFEF4444);
  static const _border = Color(0xFFE5E7EB);
  static const _lightBg = Color(0xFFFFFBEB);

  // ─── State ──────────────────────────────────────────────────────────────
  _FilterPeriod _currentPeriod = _FilterPeriod.all;
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

  // Expand/Collapse transaction details
  bool _isExpanded = true;

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
      moduleId: 'mod_vang',
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

  // ─── Computed Stats ─────────────────────────────────────────────────────

  List<Transaction> get _displayedTransactions {
    if (_searchQuery.isEmpty) return _transactions;
    final q = _searchQuery.toLowerCase();
    return _transactions.where((t) {
      final titleMatch = t.title.toLowerCase().contains(q);
      final noteMatch = (t.note ?? '').toLowerCase().contains(q);
      return titleMatch || noteMatch;
    }).toList();
  }

  /// Chi tiêu Chi = Mua vàng, Chi tiêu Thu = Bán vàng
  List<Transaction> get _buyTransactions => _transactions.where((t) => t.isExpense).toList();
  List<Transaction> get _sellTransactions => _transactions.where((t) => t.isIncome).toList();

  double get _totalBoughtChi => _buyTransactions.fold(0.0, (s, t) => s + t.quantity);
  double get _totalSoldChi => _sellTransactions.fold(0.0, (s, t) => s + t.quantity);
  double get _currentChi => _totalBoughtChi - _totalSoldChi;

  /// Last purchase info
  Transaction? get _lastPurchase {
    if (_buyTransactions.isEmpty) return null;
    final sorted = List<Transaction>.from(_buyTransactions)..sort((a, b) => b.date.compareTo(a.date));
    return sorted.first;
  }

  /// Average cost per chỉ = weighted average of (price_per_unit) across all buy transactions
  /// Công thức: sum(price_per_unit_i * qty_i) / sum(qty_i)
  /// Không dùng (totalBought - totalSold) / currentChi vì sẽ sai khi mua nhiều chỉ/giao dịch
  double get _averageCost {
    if (_currentChi <= 0) return 0;
    double totalWeighted = 0;
    double totalQty = 0;
    for (final t in _buyTransactions) {
      if (t.quantity <= 0) continue; // bỏ qua record thiếu số chỉ
      final qty = t.quantity.toDouble();
      final unitPrice = t.amount / qty;
      if (unitPrice <= 0) continue; // bỏ qua record thiếu giá
      totalWeighted += unitPrice * qty;
      totalQty += qty;
    }
    if (totalQty <= 0) return 0;
    return totalWeighted / totalQty;
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
      MaterialPageRoute(
        builder: (_) => const AddTransactionScreen(preSelectedModuleId: 'mod_vang'),
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
                              const SizedBox(height: 6),
                              _buildDateRange(),
                              const SizedBox(height: 10),
                            ],
                            _buildStats(),
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
            child: const Icon(Icons.diamond, color: _primaryGold, size: 22),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Vàng', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _navy)),
                Text('Quản lý mua bán và tồn vàng', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
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
            icon: Icon(_showFilter ? Icons.tune : Icons.tune_outlined, color: _showFilter ? _primaryGold : _navy),
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
              hintText: 'Tìm theo loại vàng hoặc ghi chú...',
              hintStyle: TextStyle(fontSize: 14, color: Colors.grey[400]),
              prefixIcon: const Icon(Icons.search, size: 20),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _border)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _border)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _primaryGold)),
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
          ...[_FilterPeriod.month, _FilterPeriod.year, _FilterPeriod.all].map((p) {
            final selected = _currentPeriod == p;
            final label = switch (p) {
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
                    color: selected ? _primaryGold : Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: selected ? _primaryGold : _border),
                  ),
                  child: Center(
                    child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: selected ? Colors.white : _navy)),
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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Từ ngày', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                const SizedBox(height: 4),
                GestureDetector(
                  onTap: _pickFromDate,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                    decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(8)),
                    child: Row(
                      children: [
                        Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]),
                        const SizedBox(width: 8),
                        Text(fromText, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Text('-', style: TextStyle(fontSize: 16, color: Colors.grey))),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Đến ngày', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                const SizedBox(height: 4),
                GestureDetector(
                  onTap: _pickToDate,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                    decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(8)),
                    child: Row(
                      children: [
                        Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]),
                        const SizedBox(width: 8),
                        Text(toText, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── Stats ──────────────────────────────────────────────────────────────

  Widget _buildStats() {
    final lastPurchase = _lastPurchase;
    final df = DateFormat('dd/MM/yyyy');
    final avgCostFormatted = NumberFormat('#,###', 'vi_VN').format(_averageCost.toInt());

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          // Row 1: 3 cards
          Row(
            children: [
              Expanded(child: _statCard(
                icon: Icons.trending_up,
                iconColor: _primaryGold,
                label: 'TỔNG SỐ (CHỈ)',
                value: '${_totalBoughtChi.toStringAsFixed(0)} chỉ',
                subtitle: 'Tổng đã mua trừ bán',
              )),
              const SizedBox(width: 8),
              Expanded(child: _statCard(
                icon: Icons.sell_outlined,
                iconColor: _red,
                label: 'ĐÃ BÁN',
                value: '${_totalSoldChi.toStringAsFixed(0)} chỉ',
                subtitle: 'Tổng đã bán',
              )),
              const SizedBox(width: 8),
              Expanded(child: _statCard(
                icon: Icons.diamond_outlined,
                iconColor: _green,
                label: 'HIỆN TẠI',
                value: '${_currentChi.toStringAsFixed(0)} chỉ',
                subtitle: 'Số lượng còn lại',
              )),
            ],
          ),
          const SizedBox(height: 8),
          // Row 2: 2 cards
          Row(
            children: [
              Expanded(child: _statCardLarge(
                icon: Icons.shopping_cart_outlined,
                iconColor: _darkGold,
                label: 'ĐÃ MUA GẦN NHẤT',
                value: lastPurchase != null ? '${lastPurchase.quantity} chỉ' : '--',
                line2: lastPurchase != null ? '${NumberFormat('#,###', 'vi_VN').format((lastPurchase.amount / lastPurchase.quantity).toInt())} đ/chỉ' : '',
                line3: lastPurchase != null ? df.format(lastPurchase.date) : '',
              )),
              const SizedBox(width: 8),
              Expanded(child: _statCardLarge(
                icon: Icons.star_outline,
                iconColor: _primaryGold,
                label: 'GIÁ VỐN TRUNG BÌNH',
                value: '$avgCostFormatted đ/chỉ',
                line2: 'Trung bình giá mua/chỉ',
                line3: '',
              )),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statCard({required IconData icon, required Color iconColor, required String label, required String value, required String subtitle}) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: Colors.grey[600])),
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(icon, size: 18, color: iconColor),
              const SizedBox(width: 6),
              Flexible(child: Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _navy), maxLines: 1, overflow: TextOverflow.ellipsis)),
            ],
          ),
          const SizedBox(height: 3),
          Text(subtitle, style: TextStyle(fontSize: 9, color: Colors.grey[500]), maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }

  Widget _statCardLarge({required IconData icon, required Color iconColor, required String label, required String value, required String line2, required String line3}) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: Colors.grey[600])),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(icon, size: 20, color: iconColor),
              const SizedBox(width: 8),
              Flexible(child: Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _navy), maxLines: 1, overflow: TextOverflow.ellipsis)),
            ],
          ),
          if (line2.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(line2, style: TextStyle(fontSize: 10, color: Colors.grey[600])),
          ],
          if (line3.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(line3, style: TextStyle(fontSize: 10, color: Colors.grey[500])),
          ],
        ],
      ),
    );
  }

  // ─── Expand/Collapse Toggle ─────────────────────────────────────────────

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
              Icon(_isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down, size: 18, color: _primaryGold),
              const SizedBox(width: 4),
              Text(_isExpanded ? 'Thu gọn' : 'Mở rộng', style: const TextStyle(fontSize: 12, color: _primaryGold, fontWeight: FontWeight.w500)),
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
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: const BoxDecoration(
        color: _primaryGold,
        borderRadius: BorderRadius.only(topLeft: Radius.circular(8), topRight: Radius.circular(8)),
      ),
      child: const Row(
        children: [
          SizedBox(width: 70, child: Text('NGÀY', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white))),
          Expanded(flex: 3, child: Text('LOẠI VÀNG', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white))),
          SizedBox(width: 50, child: Text('LOẠI GD', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white), textAlign: TextAlign.center)),
          Expanded(flex: 3, child: Text('SỐ TIỀN', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white), textAlign: TextAlign.right)),
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
        decoration: BoxDecoration(
          border: Border.all(color: _border),
          borderRadius: const BorderRadius.only(bottomLeft: Radius.circular(8), bottomRight: Radius.circular(8)),
        ),
        child: Center(
          child: Column(
            children: [
              Icon(Icons.diamond_outlined, size: 48, color: Colors.grey[300]),
              const SizedBox(height: 8),
              Text('Chưa có giao dịch vàng', style: TextStyle(color: Colors.grey[500])),
            ],
          ),
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        border: Border.all(color: _border),
        borderRadius: const BorderRadius.only(bottomLeft: Radius.circular(8), bottomRight: Radius.circular(8)),
      ),
      child: Column(
        children: txns.map((t) => _buildTransactionItem(t)).toList(),
      ),
    );
  }

  Widget _buildTransactionItem(Transaction t) {
    final df = DateFormat('dd/MM/yyyy');
    final isBuy = t.isExpense; // Chi = Mua
    final typeLabel = isBuy ? 'Mua' : 'Bán';
    final typeColor = isBuy ? _primaryGold : _red;
    final amountFormatted = '${NumberFormat('#,###', 'vi_VN').format(t.amount.toInt())} đ';
    final pricePerChi = t.quantity > 0 ? t.amount / t.quantity : 0.0;
    final pricePerChiFormatted = '${NumberFormat('#,###', 'vi_VN').format(pricePerChi.toInt())} đ';

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
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: _border.withOpacity(0.5)))),
          child: Column(
            children: [
              // Row 1: Ngày | Loại vàng | Loại GD | Số tiền
              Row(
                children: [
                  SizedBox(width: 70, child: Text(df.format(t.date), style: const TextStyle(fontSize: 12, color: _navy))),
                  Expanded(flex: 3, child: Text(t.title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _navy), maxLines: 1, overflow: TextOverflow.ellipsis)),
                  SizedBox(
                    width: 50,
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: typeColor.withOpacity(0.1), borderRadius: BorderRadius.circular(4), border: Border.all(color: typeColor.withOpacity(0.4))),
                        child: Text(typeLabel, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: typeColor)),
                      ),
                    ),
                  ),
                  Expanded(flex: 3, child: Text(amountFormatted, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _navy), textAlign: TextAlign.right)),
                ],
              ),
              // Row 2: Ghi chú | Người nhận | Số chỉ | Giá/chỉ (only when expanded)
              if (_isExpanded) ...[
                const SizedBox(height: 4),
                Row(
                  children: [
                    SizedBox(width: 70, child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('GHI CHÚ', style: TextStyle(fontSize: 8, color: Colors.grey[500])),
                        Text(t.note?.isNotEmpty == true ? t.note! : '—', style: TextStyle(fontSize: 11, color: Colors.grey[700]), maxLines: 1, overflow: TextOverflow.ellipsis),
                      ],
                    )),
                    Expanded(flex: 3, child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('NGƯỜI NHẬN', style: TextStyle(fontSize: 8, color: Colors.grey[500])),
                        Text(t.beneficiary?.isNotEmpty == true ? t.beneficiary! : '—', style: TextStyle(fontSize: 11, color: Colors.grey[700])),
                      ],
                    )),
                    SizedBox(width: 50, child: Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text('SỐ CHỈ', style: TextStyle(fontSize: 8, color: Colors.grey[500])),
                        Text('${t.quantity} chỉ', style: const TextStyle(fontSize: 11, color: _navy)),
                      ],
                    )),
                    Expanded(flex: 3, child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('GIÁ/CHỈ', style: TextStyle(fontSize: 8, color: Colors.grey[500])),
                        Text(pricePerChiFormatted, style: const TextStyle(fontSize: 11, color: _navy)),
                      ],
                    )),
                  ],
                ),
              ],
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
              // FAB
              GestureDetector(
                onTap: _addTransaction,
                child: Container(
                  width: 52, height: 52,
                  decoration: BoxDecoration(
                    color: _primaryGold,
                    shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: _primaryGold.withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 4))],
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
    final color = isActive ? _primaryGold : Colors.grey;
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
