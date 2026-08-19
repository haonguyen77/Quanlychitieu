import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../models/transaction.dart';
import '../../../providers/transaction_provider.dart';
import '../../../screens/transactions/add_transaction_screen.dart';
import '../../../utils/transaction_styles.dart';
import '../models/credit_card.dart';
import '../providers/credit_card_provider.dart';
import 'add_credit_card_screen.dart';
import 'manage_cards_screen.dart';
import 'credit_card_payment_screen.dart';

enum _FilterPeriod { month, year, all }

class CreditCardScreen extends StatefulWidget {
  const CreditCardScreen({super.key});

  @override
  State<CreditCardScreen> createState() => _CreditCardScreenState();
}

class _CreditCardScreenState extends State<CreditCardScreen> {
  // ─── Colors ─────────────────────────────────────────────────────────────
  static const _primaryPurple = Color(0xFF6C2BD9);
  static const _navy = Color(0xFF101B4D);
  static const _border = Color(0xFFE5E7EB);
  static const _lightBg = Color(0xFFF5F3FF);
  static const _green = Color(0xFF16A34A);
  static const _red = Color(0xFFEF4444);

  // ─── State ──────────────────────────────────────────────────────────────
  _FilterPeriod _currentPeriod = _FilterPeriod.month;
  DateTime _referenceDate = DateTime.now();
  DateTime? _customFromDate;
  DateTime? _customToDate;

  bool _isSearching = false;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  List<String> _searchSuggestions = [];

  bool _showFilter = false;
  bool _showStats = false; // Thu gọn mặc định ẩn stats

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<CreditCardProvider>();
      provider.loadCards().then((_) {
        if (provider.cards.isNotEmpty) {
          provider.selectCard(provider.cards.first.id);
          _loadTransactions();
        }
      });
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // ─── Date Range ─────────────────────────────────────────────────────────

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
    setState(() { _customFromDate = null; _customToDate = null;
      switch (_currentPeriod) {
        case _FilterPeriod.month: _referenceDate = DateTime(_referenceDate.year, _referenceDate.month - 1, 1);
        case _FilterPeriod.year: _referenceDate = DateTime(_referenceDate.year - 1, 1, 1);
        case _FilterPeriod.all: break;
      }
    });
    _loadTransactions();
  }

  void _nextPeriod() {
    setState(() { _customFromDate = null; _customToDate = null;
      switch (_currentPeriod) {
        case _FilterPeriod.month: _referenceDate = DateTime(_referenceDate.year, _referenceDate.month + 1, 1);
        case _FilterPeriod.year: _referenceDate = DateTime(_referenceDate.year + 1, 1, 1);
        case _FilterPeriod.all: break;
      }
    });
    _loadTransactions();
  }

  void _changePeriod(_FilterPeriod period) {
    setState(() { _currentPeriod = period; _referenceDate = DateTime.now(); _customFromDate = null; _customToDate = null; });
    _loadTransactions();
  }

  Future<void> _pickFromDate() async {
    final picked = await showDatePicker(context: context, initialDate: _startDate, firstDate: DateTime(2020), lastDate: DateTime(2099));
    if (picked != null) { setState(() => _customFromDate = picked); _loadTransactions(); }
  }

  Future<void> _pickToDate() async {
    final picked = await showDatePicker(context: context, initialDate: _endDate.isBefore(DateTime(2099)) ? _endDate : DateTime.now(), firstDate: _customFromDate ?? DateTime(2020), lastDate: DateTime(2099));
    if (picked != null) { setState(() => _customToDate = DateTime(picked.year, picked.month, picked.day, 23, 59, 59)); _loadTransactions(); }
  }

  void _loadTransactions() {
    final provider = context.read<CreditCardProvider>();
    final card = provider.selectedCard;
    if (card != null) {
      provider.loadTransactionsForCard(card.id, startDate: _startDate, endDate: _endDate);
    }
  }

  // ─── Search ─────────────────────────────────────────────────────────────

  void _updateSuggestions(String value) {
    final provider = context.read<CreditCardProvider>();
    final q = value.trim().toLowerCase();
    setState(() {
      _searchQuery = value.trim();
      if (q.isEmpty) { _searchSuggestions = []; return; }
      final seen = <String>{};
      final suggestions = <String>[];
      for (final t in provider.transactions) {
        if (t.title.toLowerCase().contains(q) && seen.add(t.title)) suggestions.add(t.title);
        final note = t.note ?? '';
        if (note.isNotEmpty && note.toLowerCase().contains(q) && seen.add(note)) suggestions.add(note);
      }
      _searchSuggestions = suggestions.take(6).toList();
    });
  }

  List<Transaction> get _displayedTransactions {
    final provider = context.read<CreditCardProvider>();
    if (_searchQuery.isEmpty) return provider.transactions;
    final q = _searchQuery.toLowerCase();
    return provider.transactions.where((t) {
      return t.title.toLowerCase().contains(q) || (t.note ?? '').toLowerCase().contains(q);
    }).toList();
  }

  // ─── Actions ────────────────────────────────────────────────────────────

  void _addTransaction() {
    final provider = context.read<CreditCardProvider>();
    final card = provider.selectedCard;
    if (card == null) return;
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => AddTransactionScreen(preSelectedAccountId: 'acc_cc_${card.id}'),
    )).then((_) { provider.loadCards(); _loadTransactions(); });
  }

  void _openEdit(Transaction t) {
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => AddTransactionScreen(editTransaction: t),
    )).then((result) {
      if (result == true) {
        final provider = context.read<CreditCardProvider>();
        provider.loadCards();
        _loadTransactions();
      }
    });
  }

  void _openManageCards() {
    Navigator.push(context, MaterialPageRoute(builder: (_) => const ManageCardsScreen()))
        .then((_) => context.read<CreditCardProvider>().loadCards());
  }

  void _openPayment() {
    Navigator.push(context, MaterialPageRoute(builder: (_) => const CreditCardPaymentScreen()))
        .then((_) { context.read<CreditCardProvider>().loadCards(); _loadTransactions(); });
  }

  // ─── Build ──────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Consumer<CreditCardProvider>(
          builder: (context, provider, child) {
            return Column(
              children: [
                _buildHeader(),
                Expanded(
                  child: provider.isLoading
                      ? const Center(child: CircularProgressIndicator())
                      : RefreshIndicator(
                          onRefresh: () async { await provider.loadCards(); _loadTransactions(); },
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
                                _buildMyCards(provider),
                                if (_showStats) _buildStatCards(provider),
                                const SizedBox(height: 8),
                                _buildTransactionListHeader(),
                                _buildTransactionList(provider),
                                const SizedBox(height: 80),
                              ],
                            ),
                          ),
                        ),
                ),
              ],
            );
          },
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
            child: const Icon(Icons.credit_card, color: _primaryPurple, size: 22),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Thẻ tín dụng', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _navy)),
                Text('Quản lý thẻ tín dụng, trả góp', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ],
            ),
          ),
          IconButton(
            icon: Icon(_isSearching ? Icons.close : Icons.search, color: _navy),
            onPressed: () { setState(() { _isSearching = !_isSearching; if (!_isSearching) { _searchController.clear(); _searchQuery = ''; _searchSuggestions = []; } }); },
          ),
          IconButton(
            icon: Icon(_showFilter ? Icons.tune : Icons.tune_outlined, color: _showFilter ? _primaryPurple : _navy),
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
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(
          controller: _searchController, autofocus: true,
          decoration: InputDecoration(
            hintText: 'Tìm theo tên giao dịch hoặc ghi chú...',
            hintStyle: TextStyle(fontSize: 14, color: Colors.grey[400]),
            prefixIcon: const Icon(Icons.search, size: 20),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _border)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _border)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _primaryPurple)),
            filled: true, fillColor: _lightBg,
          ),
          onChanged: _updateSuggestions,
        ),
        if (_searchSuggestions.isNotEmpty)
          Container(
            constraints: const BoxConstraints(maxHeight: 180), margin: const EdgeInsets.only(top: 4),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: _border), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4)]),
            child: ListView.builder(shrinkWrap: true, padding: EdgeInsets.zero, itemCount: _searchSuggestions.length, itemBuilder: (context, i) {
              final s = _searchSuggestions[i];
              return ListTile(dense: true, visualDensity: const VisualDensity(vertical: -2), leading: Icon(Icons.history, size: 16, color: Colors.grey[400]),
                title: Text(s, style: const TextStyle(fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                onTap: () { _searchController.text = s; _searchController.selection = TextSelection.fromPosition(TextPosition(offset: s.length)); _updateSuggestions(s); });
            }),
          ),
      ]),
    );
  }

  // ─── Period Filter ──────────────────────────────────────────────────────

  Widget _buildPeriodFilter() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(children: [
        _arrowBtn(Icons.chevron_left, _currentPeriod != _FilterPeriod.all ? _previousPeriod : null),
        const SizedBox(width: 4),
        ...[_FilterPeriod.month, _FilterPeriod.year, _FilterPeriod.all].map((p) {
          final selected = _currentPeriod == p;
          final label = switch (p) { _FilterPeriod.month => 'Tháng', _FilterPeriod.year => 'Năm', _FilterPeriod.all => 'Tất cả' };
          return Expanded(child: GestureDetector(onTap: () => _changePeriod(p), child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 3), padding: const EdgeInsets.symmetric(vertical: 9),
            decoration: BoxDecoration(color: selected ? _primaryPurple : Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: selected ? _primaryPurple : _border)),
            child: Center(child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: selected ? Colors.white : _navy))),
          )));
        }),
        const SizedBox(width: 4),
        _arrowBtn(Icons.chevron_right, _currentPeriod != _FilterPeriod.all ? _nextPeriod : null),
      ]),
    );
  }

  Widget _arrowBtn(IconData icon, VoidCallback? onTap) {
    return GestureDetector(onTap: onTap, child: Container(
      width: 36, height: 36,
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: _border)),
      child: Icon(icon, size: 20, color: onTap != null ? _navy : Colors.grey[300]),
    ));
  }

  // ─── Date Range ─────────────────────────────────────────────────────────

  Widget _buildDateRange() {
    final df = DateFormat('dd/MM/yyyy');
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Từ ngày', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
          const SizedBox(height: 4),
          GestureDetector(onTap: _pickFromDate, child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(8)),
            child: Row(children: [Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]), const SizedBox(width: 8), Text(df.format(_startDate), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500))]),
          )),
        ])),
        const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Text('-', style: TextStyle(fontSize: 16, color: Colors.grey))),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Đến ngày', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
          const SizedBox(height: 4),
          GestureDetector(onTap: _pickToDate, child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(8)),
            child: Row(children: [Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]), const SizedBox(width: 8), Text(df.format(_endDate.isBefore(DateTime(2099)) ? _endDate : DateTime.now()), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500))]),
          )),
        ])),
      ]),
    );
  }

  // ─── My Cards ───────────────────────────────────────────────────────────

  // Card colors palette for random assignment
  static const _cardColors = [
    Color(0xFF1264F5), // Blue
    Color(0xFF6C2BD9), // Purple
    Color(0xFFEF4444), // Red
    Color(0xFF16A34A), // Green
    Color(0xFFD97706), // Amber
    Color(0xFF0891B2), // Cyan
    Color(0xFFDB2777), // Pink
    Color(0xFF4F46E5), // Indigo
  ];

  Color _getCardColor(int index) {
    return _cardColors[index % _cardColors.length];
  }

  Widget _buildMyCards(CreditCardProvider provider) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(children: [
        // Card chips first
        if (provider.cards.isEmpty)
          GestureDetector(
            onTap: _openManageCards,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(12)),
              child: Column(children: [
                Icon(Icons.add_card, size: 32, color: Colors.grey[400]),
                const SizedBox(height: 8),
                Text('Thêm thẻ tín dụng', style: TextStyle(color: Colors.grey[500])),
              ]),
            ),
          )
        else
          SizedBox(
            height: 90,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: provider.cards.length,
              itemBuilder: (context, i) {
                final card = provider.cards[i];
                final isSelected = provider.selectedCard?.id == card.id;
                final cardColor = _getCardColor(i);
                return GestureDetector(
                  onTap: () { provider.selectCard(card.id); _loadTransactions(); },
                  child: Container(
                    width: 140, margin: const EdgeInsets.only(right: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isSelected ? cardColor.withOpacity(0.04) : Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: isSelected ? cardColor : _border, width: isSelected ? 2 : 1),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(card.name.length > 2 ? card.name.substring(0, 2).toUpperCase() : card.name.toUpperCase(),
                              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: cardColor)),
                            Icon(Icons.credit_card, size: 20, color: cardColor.withOpacity(0.6)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(card.last4 != null ? '**** ${card.last4}' : '**** ****',
                          style: TextStyle(fontSize: 12, color: Colors.grey[600], fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        const SizedBox(height: 12),
        // Action buttons below cards
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _actionBtn('Quản lý thẻ', Colors.orange[700]!, _openManageCards),
            const SizedBox(width: 8),
            _actionBtn('Thanh toán thẻ', _green, _openPayment),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () => setState(() => _showStats = !_showStats),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: _primaryPurple.withOpacity(0.5))),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(_showStats ? 'Thu gọn' : 'Mở rộng', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: _primaryPurple)),
                  const SizedBox(width: 2),
                  Icon(_showStats ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down, size: 16, color: _primaryPurple),
                ]),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
      ]),
    );
  }

  Widget _actionBtn(String label, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: color.withOpacity(0.5))),
        child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: color)),
      ),
    );
  }

  // ─── Stat Cards ─────────────────────────────────────────────────────────

  Widget _buildStatCards(CreditCardProvider provider) {
    final card = provider.selectedCard;
    if (card == null) return const SizedBox();

    final limit = card.creditLimit;
    final debt = card.currentDebt ?? 0;
    final remaining = limit - debt;
    final usagePercent = limit > 0 ? (debt / limit * 100) : 0.0;
    final remainPercent = limit > 0 ? (remaining / limit * 100) : 0.0;
    final dueDate = card.currentPaymentDueDate;
    final daysLeft = dueDate.difference(DateTime.now()).inDays;
    final nf = NumberFormat('#,###', 'vi_VN');
    final df = DateFormat('dd/MM/yyyy');

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(children: [
        Row(children: [
          Expanded(child: _statBox(Icons.credit_card, _primaryPurple, 'Tổng hạn mức', '${nf.format(limit.toInt())}', 'VND', null)),
          const SizedBox(width: 8),
          Expanded(child: _statBox(Icons.trending_down, _red, 'Đã sử dụng', '-${nf.format(debt.toInt())} VND', '(${usagePercent.toStringAsFixed(2)}%)', _red)),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: _statBox(Icons.account_balance_wallet, _green, 'Còn lại', '${nf.format(remaining.toInt())} VND', '(${remainPercent.toStringAsFixed(2)}%)', _green)),
          const SizedBox(width: 8),
          Expanded(child: _statBox(Icons.calendar_today, Colors.blue[700]!, 'Đến hạn thanh toán', df.format(dueDate), 'Còn $daysLeft ngày', null)),
        ]),
        const SizedBox(height: 10),
      ]),
    );
  }

  Widget _statBox(IconData icon, Color color, String label, String value, String? subtitle, Color? subtitleColor) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: _border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 28, height: 28, decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(6)), child: Icon(icon, size: 14, color: color)),
          const SizedBox(width: 8),
          Flexible(child: Text(label, style: TextStyle(fontSize: 10, color: Colors.grey[600]), maxLines: 1, overflow: TextOverflow.ellipsis)),
        ]),
        const SizedBox(height: 8),
        Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: subtitleColor ?? _navy), maxLines: 1, overflow: TextOverflow.ellipsis),
        if (subtitle != null) Text(subtitle, style: TextStyle(fontSize: 10, color: subtitleColor ?? Colors.grey[500])),
      ]),
    );
  }

  // ─── Transaction List ───────────────────────────────────────────────────

  Widget _buildTransactionListHeader() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: const BoxDecoration(
        color: _primaryPurple,
        borderRadius: BorderRadius.only(topLeft: Radius.circular(8), topRight: Radius.circular(8)),
      ),
      child: const Row(children: [
        Expanded(child: Text('Tên giao dịch', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white))),
        Text('Số tiền', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
      ]),
    );
  }

  Widget _buildTransactionList(CreditCardProvider provider) {
    final txns = _displayedTransactions;
    if (txns.isEmpty) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16),
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: const BorderRadius.only(bottomLeft: Radius.circular(8), bottomRight: Radius.circular(8))),
        child: Center(child: Column(children: [
          Icon(Icons.credit_card_off, size: 48, color: Colors.grey[300]),
          const SizedBox(height: 8),
          Text('Chưa có giao dịch', style: TextStyle(color: Colors.grey[500])),
        ])),
      );
    }

    // Group by day
    final grouped = <DateTime, List<Transaction>>{};
    for (final t in txns) {
      final key = DateTime(t.date.year, t.date.month, t.date.day);
      grouped.putIfAbsent(key, () => []).add(t);
    }
    final sortedDays = grouped.keys.toList()..sort((a, b) => b.compareTo(a));
    final df = DateFormat('dd/MM/yyyy');
    final nf = NumberFormat('#,###', 'vi_VN');

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: const BorderRadius.only(bottomLeft: Radius.circular(8), bottomRight: Radius.circular(8))),
      child: Column(children: sortedDays.map((day) {
        final dayTxns = grouped[day]!;
        final dayTotal = dayTxns.fold(0.0, (s, t) => s + (t.type == 2 ? t.amount : -t.amount));
        final now = DateTime.now();
        final isToday = day.year == now.year && day.month == now.month && day.day == now.day;
        final isYesterday = day.year == now.year && day.month == now.month && day.day == now.day - 1;
        String dayLabel;
        if (isToday) {
          dayLabel = 'Hôm nay, ${df.format(day)}';
        } else if (isYesterday) {
          dayLabel = 'Hôm qua, ${df.format(day)}';
        } else {
          dayLabel = df.format(day);
        }

        return Column(children: [
          // Day header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            color: Colors.grey[50],
            child: Row(children: [
              Icon(Icons.calendar_today, size: 12, color: Colors.grey[500]),
              const SizedBox(width: 6),
              Text(dayLabel, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.grey[700])),
              const Spacer(),
              if (dayTxns.length >= 2)
                Text('${dayTotal >= 0 ? '+' : ''}${nf.format(dayTotal.toInt())} VND',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: dayTotal >= 0 ? _green : _red)),
            ]),
          ),
          ...dayTxns.map((t) => _buildTransactionItem(t)),
        ]);
      }).toList()),
    );
  }

  Widget _buildTransactionItem(Transaction t) {
    final isPayment = t.type == 2;
    final nf = NumberFormat('#,###', 'vi_VN');
    final amountText = isPayment ? '+${nf.format(t.amount.toInt())} VND' : '-${nf.format(t.amount.toInt())} VND';
    final amountColor = isPayment ? _green : _red;

    // Get category color from TransactionStyles
    final cat = TransactionStyles.categoryByName(t.categoryName);
    final typeColor = isPayment ? _green : cat.color;
    final typeIcon = isPayment ? Icons.check_circle_outline : cat.icon;

    // Module icon & color
    final moduleColor = TransactionStyles.moduleColorByName(t.moduleName);
    final moduleIcon = TransactionStyles.moduleIconByName(t.moduleName);

    return Dismissible(
      key: Key(t.id),
      direction: DismissDirection.endToStart,
      background: Container(alignment: Alignment.centerRight, padding: const EdgeInsets.only(right: 20), color: Colors.red, child: const Icon(Icons.delete, color: Colors.white)),
      confirmDismiss: (direction) async {
        return await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
          title: const Text('Xóa giao dịch'), content: Text('Xóa "${t.title}"?'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('Xóa')),
          ],
        ));
      },
      onDismissed: (direction) async {
        await context.read<TransactionProvider>().deleteTransaction(t.id);
        context.read<CreditCardProvider>().loadCards();
        _loadTransactions();
      },
      child: InkWell(
        onTap: () => _openEdit(t),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: _border.withOpacity(0.5)))),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Large category icon (spanning 2 rows height)
              Container(
                width: 44, height: 44,
                decoration: BoxDecoration(color: typeColor.withOpacity(0.12), borderRadius: BorderRadius.circular(12)),
                child: Icon(typeIcon, size: 22, color: typeColor),
              ),
              const SizedBox(width: 12),
              // Content (2 rows)
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Row 1: Title
                    Text(t.title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _navy), maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 4),
                    // Row 2: Module icon + module name
                    Row(children: [
                      Icon(moduleIcon, size: 14, color: moduleColor),
                      const SizedBox(width: 4),
                      Text(t.moduleName ?? '', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: moduleColor)),
                    ]),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              // Amount
              Text(amountText, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: amountColor)),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Bottom Navigation ──────────────────────────────────────────────────

  Widget _buildBottomNav() {
    return Container(
      decoration: BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 10, offset: const Offset(0, -2))]),
      child: SafeArea(
        child: SizedBox(height: 64, child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
          _navItem(Icons.bar_chart_outlined, 'Dashboard', false, () => Navigator.pop(context)),
          _navItem(Icons.receipt_long_outlined, 'Chi tiêu', false, () => Navigator.pop(context)),
          GestureDetector(onTap: _addTransaction, child: Container(
            width: 52, height: 52,
            decoration: BoxDecoration(color: _primaryPurple, shape: BoxShape.circle, boxShadow: [BoxShadow(color: _primaryPurple.withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 4))]),
            child: const Icon(Icons.add, color: Colors.white, size: 26),
          )),
          _navItem(Icons.category, 'Danh mục', true, null),
          _navItem(Icons.settings_outlined, 'Cài đặt', false, () => Navigator.pop(context)),
        ])),
      ),
    );
  }

  Widget _navItem(IconData icon, String label, bool isActive, VoidCallback? onTap) {
    final color = isActive ? _primaryPurple : Colors.grey;
    return GestureDetector(onTap: onTap, behavior: HitTestBehavior.opaque, child: SizedBox(width: 60, child: Column(
      mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(icon, color: color, size: 22), const SizedBox(height: 3),
        Text(label, style: TextStyle(fontSize: 10, color: color, fontWeight: isActive ? FontWeight.w600 : FontWeight.normal)),
      ],
    )));
  }
}
