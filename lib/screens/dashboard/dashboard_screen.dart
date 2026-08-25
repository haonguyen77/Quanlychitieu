import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../database/database_helper.dart';
import '../../models/transaction.dart';
import '../../providers/transaction_provider.dart';
import '../../modules/credit_card/providers/credit_card_provider.dart';
import '../../modules/credit_card/models/credit_card.dart';
import '../../modules/credit_card/screens/credit_card_screen.dart';
import '../../modules/rental/providers/rental_provider.dart';
import '../../modules/rental/screens/rental_home_screen.dart';
import '../../utils/transaction_styles.dart';
import '../transactions/add_transaction_screen.dart';
import '../settings/recurring_reminder_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum _FilterPeriod { week, month, year, all }

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  // Colors
  static const _purple = Color(0xFF7B1FA2);
  static const _darkPurple = Color(0xFF4A148C);
  static const _navy = Color(0xFF0F1F4D);
  static const _red = Color(0xFFEF3030);
  static const _green = Color(0xFF20A84A);
  static const _blue = Color(0xFF1565C0);
  static const _orange = Color(0xFFFF8F00);
  static const _border = Color(0xFFE5E7EB);
  static const _bgLight = Color(0xFFF5F7FA);

  _FilterPeriod _currentPeriod = _FilterPeriod.month;
  DateTime _referenceDate = DateTime.now();
  bool _showFilter = false;

  // Data
  List<Transaction> _transactions = [];
  double _totalIncome = 0;
  double _totalExpense = 0;
  double _totalDebt = 0;
  List<CreditCard> _creditCards = [];
  Map<String, double> _categoryExpenses = {};
  Map<String, String> _categoryNames = {};
  List<_AlertItem> _alerts = [];
  bool _isLoading = true;

  // So sánh chi tiêu
  DateTime _compareMonth1 = DateTime(DateTime.now().year, DateTime.now().month - 1, 1);
  DateTime _compareMonth2 = DateTime(DateTime.now().year, DateTime.now().month, 1);
  Map<String, double> _month1Categories = {};
  Map<String, double> _month2Categories = {};
  bool _showAllComparison = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  DateTime get _startDate {
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

  int get _daysInPeriod {
    final diff = _endDate.difference(_startDate).inDays;
    return diff > 0 ? diff : 1;
  }

  /// Format large numbers in short form: 3.000.000 → 3M, 3.500.000 → 3M5, 3.150.000 → 3M15
  String _formatShort(double amount) {
    final abs = amount.abs();
    final prefix = amount < 0 ? '-' : '';
    if (abs >= 1000000) {
      final millions = (abs / 1000000).floor();
      final hundredThousands = ((abs - millions * 1000000) / 100000).floor();
      final tenThousands = ((abs - millions * 1000000 - hundredThousands * 100000) / 10000).round();

      if (hundredThousands == 0 && tenThousands == 0) {
        return '$prefix${millions}M';
      } else if (tenThousands == 0) {
        return '$prefix${millions}M$hundredThousands';
      } else {
        return '$prefix${millions}M$hundredThousands$tenThousands';
      }
    } else if (abs >= 1000) {
      final nf = NumberFormat('#,###', 'vi_VN');
      return '$prefix${nf.format(abs.toInt())}';
    } else {
      return '$prefix${abs.toInt()}';
    }
  }

  void _changePeriod(_FilterPeriod period) {
    setState(() { _currentPeriod = period; _referenceDate = DateTime.now(); });
    _loadData();
  }

  void _navigatePeriod(int direction) {
    setState(() {
      switch (_currentPeriod) {
        case _FilterPeriod.week:
          _referenceDate = _referenceDate.add(Duration(days: 7 * direction));
        case _FilterPeriod.month:
          _referenceDate = DateTime(_referenceDate.year, _referenceDate.month + direction, 1);
        case _FilterPeriod.year:
          _referenceDate = DateTime(_referenceDate.year + direction, 1, 1);
        case _FilterPeriod.all:
          break;
      }
    });
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);

    final provider = context.read<TransactionProvider>();
    final ccProvider = context.read<CreditCardProvider>();
    final rentalProvider = context.read<RentalProvider>();

    // Load transactions in date range
    final txns = await provider.search(startDate: _startDate, endDate: _endDate);
    _transactions = txns;

    // Calculate totals
    _totalIncome = txns.where((t) => t.type == 1).fold(0.0, (s, t) => s + t.amount);
    _totalExpense = txns.where((t) => t.type == 0).fold(0.0, (s, t) => s + t.amount);

    // Credit cards
    await ccProvider.loadCards();
    _creditCards = ccProvider.cards;
    _totalDebt = ccProvider.totalDebt;

    // Category expenses
    _categoryExpenses = {};
    _categoryNames = {};
    for (final t in txns.where((t) => t.type == 0)) {
      final catId = t.categoryId ?? 'other';
      final catName = t.categoryName ?? 'Khác';
      _categoryExpenses[catId] = (_categoryExpenses[catId] ?? 0) + t.amount;
      _categoryNames[catId] = catName;
    }

    // Alerts
    _alerts = [];
    // Credit card due dates
    for (final card in _creditCards) {
      final dueDate = card.currentPaymentDueDate;
      final daysLeft = dueDate.difference(DateTime.now()).inDays;
      if (daysLeft >= 0 && daysLeft <= 30 && (card.currentDebt ?? 0) > 0) {
        final nf = NumberFormat('#,###', 'vi_VN');
        _alerts.add(_AlertItem(
          icon: Icons.credit_card,
          color: _purple,
          title: 'Trả thẻ tín dụng ${card.name}',
          subtitle: 'Số tiền đến hạn: ${nf.format((card.currentDebt ?? 0).toInt())}đ',
          daysLeft: daysLeft,
          dueDate: dueDate,
          type: _AlertType.creditCard,
          data: card,
        ));
      }
    }

    // Rental bills due
    final now = DateTime.now();
    await rentalProvider.loadBills(now.year, now.month);
    for (final bill in rentalProvider.unpaidBills) {
      // Assume rent due on 15th of the month
      final dueDate = DateTime(bill.year, bill.month, 15);
      final daysLeft = dueDate.difference(now).inDays;
      if (daysLeft >= -5 && daysLeft <= 30) {
        _alerts.add(_AlertItem(
          icon: Icons.apartment,
          color: _green,
          title: 'Thu tiền nhà tháng ${bill.month}',
          subtitle: 'Khách thuê: ${bill.tenantName ?? ''} - ${bill.roomName ?? ''}',
          daysLeft: daysLeft.clamp(0, 999),
          dueDate: dueDate,
          type: _AlertType.rental,
          data: bill,
        ));
      }
    }

    // Warranty alerts
    final db = await DatabaseHelper.instance.database;
    final warrantyResults = await db.rawQuery('''
      SELECT t.*, c.name as category_name, a.name as account_name, m.name as module_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN modules m ON t.module_id = m.id
      WHERE t.warranty_date IS NOT NULL AND t.is_deleted = 0
        AND t.warranty_date >= ? AND t.warranty_date <= ?
      ORDER BY t.warranty_date ASC
    ''', [now.toIso8601String(), now.add(const Duration(days: 60)).toIso8601String()]);

    for (final row in warrantyResults) {
      final t = Transaction.fromMap(row);
      final warrantyEnd = t.warrantyDate!;
      final daysLeft = warrantyEnd.difference(now).inDays;
      final df = DateFormat('dd/MM/yyyy');
      _alerts.add(_AlertItem(
        icon: Icons.security,
        color: _orange,
        title: 'Hết hạn bảo hành - ${t.title}',
        subtitle: 'Ngày mua: ${df.format(t.date)}    Hết hạn: ${df.format(warrantyEnd)}',
        daysLeft: daysLeft,
        dueDate: warrantyEnd,
        type: _AlertType.warranty,
        data: t,
      ));
    }

    _alerts.sort((a, b) => a.daysLeft.compareTo(b.daysLeft));

    // Recurring reminders — show upcoming within 7 days
    try {
      final prefs = await SharedPreferences.getInstance();
      final json = prefs.getString('recurring_reminders');
      if (json != null) {
        final list = (jsonDecode(json) as List<dynamic>)
            .map((e) => RecurringReminder.fromMap(e as Map<String, dynamic>))
            .where((r) => r.enabled)
            .toList();
        for (final r in list) {
          DateTime nextDue;
          switch (r.frequency) {
            case 'weekly':
              nextDue = now;
              while (nextDue.weekday != (r.dayOfWeek ?? 1) % 7 + 1) {
                nextDue = nextDue.add(const Duration(days: 1));
              }
              break;
            case 'monthly':
              int day = r.dayOfMonth > 28 ? 28 : r.dayOfMonth;
              nextDue = DateTime(now.year, now.month, day);
              if (nextDue.isBefore(now.subtract(const Duration(days: 1)))) {
                nextDue = DateTime(now.year, now.month + 1, day);
              }
              break;
            default: // daily
              nextDue = DateTime(now.year, now.month, now.day + 1);
          }
          final daysLeft = nextDue.difference(DateTime(now.year, now.month, now.day)).inDays;
          if (daysLeft <= 7 && daysLeft >= 0) {
            _alerts.add(_AlertItem(
              icon: Icons.event_repeat,
              color: const Color(0xFF1565C0),
              title: r.title,
              subtitle: _recurringSubtitle(r),
              daysLeft: daysLeft,
              dueDate: nextDue,
              type: _AlertType.recurring,
              data: r,
            ));
          }
        }
        _alerts.sort((a, b) => a.daysLeft.compareTo(b.daysLeft));
      }
    } catch (_) {}

    // Load comparison data
    await _loadComparisonData();

    if (mounted) setState(() => _isLoading = false);
  }

  Future<void> _loadComparisonData() async {
    final provider = context.read<TransactionProvider>();
    final start1 = _compareMonth1;
    final end1 = DateTime(_compareMonth1.year, _compareMonth1.month + 1, 1).subtract(const Duration(milliseconds: 1));
    final start2 = _compareMonth2;
    final end2 = DateTime(_compareMonth2.year, _compareMonth2.month + 1, 1).subtract(const Duration(milliseconds: 1));

    final txns1 = await provider.search(startDate: start1, endDate: end1);
    final txns2 = await provider.search(startDate: start2, endDate: end2);

    _month1Categories = {};
    _month2Categories = {};
    for (final t in txns1.where((t) => t.type == 0)) {
      final name = t.categoryName ?? 'Khác';
      _month1Categories[name] = (_month1Categories[name] ?? 0) + t.amount;
    }
    for (final t in txns2.where((t) => t.type == 0)) {
      final name = t.categoryName ?? 'Khác';
      _month2Categories[name] = (_month2Categories[name] ?? 0) + t.amount;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _loadData,
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.only(bottom: 90),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildHeader(),
                      if (_showFilter) ...[
                        const SizedBox(height: 8),
                        _buildPeriodFilter(),
                        const SizedBox(height: 8),
                        _buildDateRange(),
                      ],
                      const SizedBox(height: 16),
                      _buildSummaryCards(),
                      const SizedBox(height: 20),
                      _buildCategoryDonut(),
                      const SizedBox(height: 20),
                      _buildAlerts(),
                      const SizedBox(height: 20),
                      _buildComparison(),
                      const SizedBox(height: 20),
                      _buildTop5Row(),
                      const SizedBox(height: 20),
                      _buildBeneficiaries(),
                      const SizedBox(height: 16),
                    ],
                  ),
                ),
              ),
      ),
    );
  }

  // ─── HEADER ──────────────────────────────────────────────────────────────

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Row(
        children: [
          Icon(Icons.menu, color: _purple, size: 26),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Dashboard', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: _navy)),
                Text('Tổng quan tài chính cá nhân', style: TextStyle(fontSize: 12, color: Colors.grey[500])),
              ],
            ),
          ),
          IconButton(icon: const Icon(Icons.search, color: _navy), onPressed: () {}),
          IconButton(
            icon: Icon(_showFilter ? Icons.tune : Icons.tune_outlined, color: _showFilter ? _purple : _navy),
            onPressed: () => setState(() => _showFilter = !_showFilter),
          ),
        ],
      ),
    );
  }

  // ─── PERIOD FILTER ───────────────────────────────────────────────────────

  Widget _buildPeriodFilter() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          _arrowBtn(Icons.chevron_left, _currentPeriod != _FilterPeriod.all ? () => _navigatePeriod(-1) : null),
          const SizedBox(width: 6),
          ...[_FilterPeriod.week, _FilterPeriod.month, _FilterPeriod.year, _FilterPeriod.all].map((p) {
            final selected = _currentPeriod == p;
            final label = switch (p) { _FilterPeriod.week => 'Tuần', _FilterPeriod.month => 'Tháng', _FilterPeriod.year => 'Năm', _FilterPeriod.all => 'Tất cả' };
            return Expanded(
              child: GestureDetector(
                onTap: () => _changePeriod(p),
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: selected ? _darkPurple : Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: selected ? _darkPurple : _border),
                  ),
                  child: Center(child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: selected ? Colors.white : _navy))),
                ),
              ),
            );
          }),
          const SizedBox(width: 6),
          _arrowBtn(Icons.chevron_right, _currentPeriod != _FilterPeriod.all ? () => _navigatePeriod(1) : null),
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
        child: Icon(icon, size: 20, color: onTap != null ? _navy : Colors.grey[300]),
      ),
    );
  }

  // ─── DATE RANGE ──────────────────────────────────────────────────────────

  Widget _buildDateRange() {
    final fmt = DateFormat('dd/MM/yyyy');
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Từ ngày', style: TextStyle(fontSize: 10, color: Colors.grey[500])),
                const SizedBox(height: 4),
                Container(
                  height: 38,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _border), borderRadius: BorderRadius.circular(8)),
                  child: Row(children: [
                    Icon(Icons.calendar_today_outlined, size: 14, color: Colors.grey[500]),
                    const SizedBox(width: 8),
                    Text(fmt.format(_startDate), style: const TextStyle(fontSize: 13, color: _navy)),
                  ]),
                ),
              ],
            ),
          ),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 10), child: Text('-', style: TextStyle(color: Colors.grey[400]))),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Đến ngày', style: TextStyle(fontSize: 10, color: Colors.grey[500])),
                const SizedBox(height: 4),
                Container(
                  height: 38,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _border), borderRadius: BorderRadius.circular(8)),
                  child: Row(children: [
                    Icon(Icons.calendar_today_outlined, size: 14, color: Colors.grey[500]),
                    const SizedBox(width: 8),
                    Text(fmt.format(_endDate), style: const TextStyle(fontSize: 13, color: _navy)),
                  ]),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── SUMMARY CARDS ───────────────────────────────────────────────────────

  Widget _buildSummaryCards() {
    final balance = _totalIncome - _totalExpense;
    final avgPerDay = _totalExpense / _daysInPeriod;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          // Row 1: Tổng thu, Tổng chi, Số dư
          Row(
            children: [
              Expanded(child: _summaryBox(Icons.account_balance_wallet, _green, 'Tổng thu', _formatShort(_totalIncome), null)),
              const SizedBox(width: 8),
              Expanded(child: _summaryBox(Icons.trending_down, _red, 'Tổng chi', _formatShort(_totalExpense), null)),
              const SizedBox(width: 8),
              Expanded(child: _summaryBox(Icons.account_balance, _blue, 'Số dư', _formatShort(balance), null)),
            ],
          ),
          const SizedBox(height: 8),
          // Row 2: Tổng nợ, Chi tiêu TB/ngày
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: _summaryBox(Icons.credit_card, _purple, 'Tổng nợ', _formatShort(_totalDebt),
                  _creditCards.isNotEmpty ? 'Còn ${_creditCards.first.currentPaymentDueDate.difference(DateTime.now()).inDays} ngày đến hạn' : null)),
                const SizedBox(width: 8),
                Expanded(child: _summaryBox(Icons.bar_chart, _orange, 'Chi tiêu TB/ngày', _formatShort(avgPerDay), null)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _summaryBox(IconData icon, Color color, String label, String value, String? subtitle) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: _border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.center, children: [
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(
            width: 28, height: 28,
            decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, size: 14, color: color),
          ),
          const SizedBox(width: 6),
          Flexible(child: Text(label, style: TextStyle(fontSize: 9, color: Colors.grey[600]), maxLines: 2, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center)),
        ]),
        const SizedBox(height: 8),
        Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color), maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center),
        if (subtitle != null) ...[
          const SizedBox(height: 2),
          Text(subtitle, style: TextStyle(fontSize: 8, color: Colors.grey[500]), maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center),
        ],
      ]),
    );
  }

  // ─── CATEGORY DONUT ──────────────────────────────────────────────────────

  Widget _buildCategoryDonut() {
    if (_categoryExpenses.isEmpty) return const SizedBox();

    final sorted = _categoryExpenses.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    final total = _totalExpense;

    final colors = [
      const Color(0xFFFF5722), Colors.orange, const Color(0xFF4CAF50),
      _purple, _blue, Colors.grey, Colors.pink, Colors.teal,
    ];

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Text('Chi tiêu theo danh mục', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _navy)),
            const SizedBox(width: 4),
            Icon(Icons.info_outline, size: 14, color: Colors.grey[400]),
          ]),
          const SizedBox(height: 16),
          Row(
            children: [
              // Donut chart
              SizedBox(
                width: 130, height: 130,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    PieChart(PieChartData(
                      sectionsSpace: 2,
                      centerSpaceRadius: 40,
                      sections: sorted.asMap().entries.map((e) {
                        return PieChartSectionData(
                          value: e.value.value,
                          color: colors[e.key % colors.length],
                          radius: 22,
                          showTitle: false,
                        );
                      }).toList(),
                    )),
                    Column(mainAxisSize: MainAxisSize.min, children: [
                      Text('Tổng chi', style: TextStyle(fontSize: 9, color: Colors.grey[500])),
                      Text(_formatShort(total), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: _navy)),
                    ]),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              // Legend (only icons, no category names)
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: sorted.take(6).toList().asMap().entries.map((e) {
                    final catName = _categoryNames[e.value.key] ?? 'Khác';
                    final pct = total > 0 ? (e.value.value / total * 100).toStringAsFixed(0) : '0';
                    final cat = TransactionStyles.categoryByName(catName);
                    final color = colors[e.key % colors.length];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(children: [
                        Container(
                          width: 24, height: 24,
                          decoration: BoxDecoration(color: cat.bgColor, borderRadius: BorderRadius.circular(6)),
                          child: Icon(cat.icon, size: 13, color: cat.color),
                        ),
                        const SizedBox(width: 12),
                        Text('$pct%', style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                        const SizedBox(width: 12),
                        Expanded(child: Text(_formatShort(e.value.value), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color), textAlign: TextAlign.right)),
                      ]),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ─── ALERTS ──────────────────────────────────────────────────────────────

  Widget _buildAlerts() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.notifications_active, size: 18, color: _orange),
            const SizedBox(width: 8),
            const Expanded(child: Text('Cảnh báo', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _navy))),
            GestureDetector(
              onTap: () { /* TODO: show all */ },
              child: Text('Xem tất cả >', style: TextStyle(fontSize: 11, color: _purple, fontWeight: FontWeight.w500)),
            ),
          ]),
          const SizedBox(height: 12),
          if (_alerts.isEmpty)
            Center(child: Text('Không có cảnh báo', style: TextStyle(fontSize: 12, color: Colors.grey[400])))
          else
            ...(_alerts.take(3).map(_buildAlertItem)),
        ],
      ),
    );
  }

  Widget _buildAlertItem(_AlertItem alert) {
    return GestureDetector(
      onTap: () => _onAlertTap(alert),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: _bgLight,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(color: alert.color.withOpacity(0.12), shape: BoxShape.circle),
              child: Icon(alert.icon, size: 18, color: alert.color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(alert.title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _navy), maxLines: 1, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 2),
                  Text(alert.subtitle, style: TextStyle(fontSize: 10, color: Colors.grey[500]), maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('Còn ${alert.daysLeft} ngày', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: alert.daysLeft <= 3 ? _red : _orange)),
                Text('Hạn chót: ${DateFormat('dd/MM/yyyy').format(alert.dueDate)}', style: TextStyle(fontSize: 9, color: Colors.grey[500])),
              ],
            ),
            const SizedBox(width: 4),
            Icon(Icons.chevron_right, size: 16, color: Colors.grey[400]),
          ],
        ),
      ),
    );
  }

  void _onAlertTap(_AlertItem alert) {
    switch (alert.type) {
      case _AlertType.creditCard:
        Navigator.push(context, MaterialPageRoute(builder: (_) => const CreditCardScreen()));
      case _AlertType.rental:
        Navigator.push(context, MaterialPageRoute(builder: (_) => const RentalHomeScreen()));
      case _AlertType.warranty:
        final t = alert.data as Transaction;
        Navigator.push(context, MaterialPageRoute(builder: (_) => AddTransactionScreen(editTransaction: t)));
      case _AlertType.recurring:
        Navigator.push(context, MaterialPageRoute(builder: (_) => const RecurringReminderScreen()));
    }
  }

  String _recurringSubtitle(RecurringReminder r) {
    switch (r.frequency) {
      case 'weekly': return 'Hàng tuần';
      case 'monthly': return 'Ngày ${r.dayOfMonth} hàng tháng';
      default: return 'Hàng ngày';
    }
  }

  // ─── COMPARISON ──────────────────────────────────────────────────────────

  Widget _buildComparison() {
    final allCategories = {..._month1Categories.keys, ..._month2Categories.keys}.toList();
    final displayCount = _showAllComparison ? allCategories.length : min(5, allCategories.length);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Line 1: Title
          Row(children: [
            const Text('So sánh chi tiêu', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _navy)),
            const SizedBox(width: 4),
            Icon(Icons.info_outline, size: 14, color: Colors.grey[400]),
          ]),
          const SizedBox(height: 10),
          // Line 2: Month selector
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            _arrowBtn(Icons.chevron_left, () {
              setState(() { _compareMonth2 = DateTime(_compareMonth2.year, _compareMonth2.month - 1, 1); _compareMonth1 = DateTime(_compareMonth2.year, _compareMonth2.month - 1, 1); });
              _loadComparisonData().then((_) => setState(() {}));
            }),
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 8),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(color: _darkPurple, borderRadius: BorderRadius.circular(14)),
              child: Text('${_compareMonth2.month.toString().padLeft(2, '0')}/${_compareMonth2.year}', style: const TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.w500)),
            ),
            _arrowBtn(Icons.chevron_right, () {
              setState(() { _compareMonth2 = DateTime(_compareMonth2.year, _compareMonth2.month + 1, 1); _compareMonth1 = DateTime(_compareMonth2.year, _compareMonth2.month - 1, 1); });
              _loadComparisonData().then((_) => setState(() {}));
            }),
          ]),
          const SizedBox(height: 12),
          // Table header
          Row(children: [
            const SizedBox(width: 30),
            Expanded(child: Text('${_compareMonth1.month.toString().padLeft(2, '0')}/${_compareMonth1.year}', style: const TextStyle(fontSize: 9, color: Colors.grey), textAlign: TextAlign.center)),
            Expanded(child: Text('${_compareMonth2.month.toString().padLeft(2, '0')}/${_compareMonth2.year}', style: const TextStyle(fontSize: 9, color: Colors.grey), textAlign: TextAlign.center)),
            const SizedBox(width: 55, child: Text('Chênh lệch', style: TextStyle(fontSize: 9, color: Colors.grey), textAlign: TextAlign.center)),
            const SizedBox(width: 40, child: Text('%', style: TextStyle(fontSize: 9, color: Colors.grey), textAlign: TextAlign.right)),
          ]),
          const Divider(height: 12),
          // Category rows
          ...allCategories.take(displayCount).map((catName) {
            final val1 = _month1Categories[catName] ?? 0;
            final val2 = _month2Categories[catName] ?? 0;
            final diff = val2 - val1;
            final pctChange = val1 > 0 ? (diff / val1 * 100) : (val2 > 0 ? 100 : 0);
            final cat = TransactionStyles.categoryByName(catName);
            final diffColor = diff >= 0 ? _red : _green;

            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(children: [
                Container(
                  width: 24, height: 24,
                  decoration: BoxDecoration(color: cat.bgColor, borderRadius: BorderRadius.circular(6)),
                  child: Icon(cat.icon, size: 12, color: cat.color),
                ),
                const SizedBox(width: 6),
                Expanded(child: Text(_formatShort(val1), style: const TextStyle(fontSize: 10, color: _navy), textAlign: TextAlign.center)),
                Expanded(child: Text(_formatShort(val2), style: const TextStyle(fontSize: 10, color: _navy), textAlign: TextAlign.center)),
                SizedBox(width: 55, child: Text('${diff >= 0 ? '+' : ''}${_formatShort(diff)}', style: TextStyle(fontSize: 9, color: diffColor), textAlign: TextAlign.center)),
                SizedBox(width: 40, child: Text('${pctChange >= 0 ? '+' : ''}${pctChange.toStringAsFixed(0)}%', style: TextStyle(fontSize: 9, color: diffColor), textAlign: TextAlign.right, overflow: TextOverflow.ellipsis)),
              ]),
            );
          }),
          if (allCategories.length > 5)
            Center(
              child: TextButton(
                onPressed: () => setState(() => _showAllComparison = !_showAllComparison),
                child: Text(_showAllComparison ? 'Thu gọn' : 'Mở rộng', style: TextStyle(fontSize: 12, color: _purple)),
              ),
            ),
        ],
      ),
    );
  }

  // ─── TOP 5 ───────────────────────────────────────────────────────────────

  Widget _buildTop5Row() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: _buildTop5Transactions(),
    );
  }

  Widget _buildTop5Transactions() {
    final nf = NumberFormat('#,###', 'vi_VN');
    final expenses = _transactions.where((t) => t.type == 0).toList()..sort((a, b) => b.amount.compareTo(a.amount));
    final top = expenses.take(5).toList();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Expanded(child: Text('Top 5 chi tiêu', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _navy))),
            GestureDetector(
              onTap: _openAllExpenses,
              child: Text('Xem tất cả >', style: TextStyle(fontSize: 11, color: _purple, fontWeight: FontWeight.w500)),
            ),
          ]),
          const SizedBox(height: 12),
          ...top.asMap().entries.map((e) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(children: [
                Container(
                  width: 22, height: 22,
                  decoration: BoxDecoration(color: _purple.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
                  child: Center(child: Text('${e.key + 1}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: _purple))),
                ),
                const SizedBox(width: 10),
                Expanded(child: Text(e.value.title, style: const TextStyle(fontSize: 13, color: _navy), maxLines: 1, overflow: TextOverflow.ellipsis)),
                Text('${nf.format(e.value.amount.toInt())}đ', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: _navy)),
              ]),
            );
          }),
        ],
      ),
    );
  }

  void _openAllExpenses() {
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => _AllExpensesScreen(startDate: _startDate, endDate: _endDate),
    ));
  }

  // ─── BENEFICIARIES ───────────────────────────────────────────────────────

  Widget _buildBeneficiaries() {
    // Group by beneficiary
    final Map<String, double> beneficiaryTotals = {};
    final Map<String, int> beneficiaryCounts = {};
    for (final t in _transactions.where((t) => t.type == 0 && t.beneficiary != null && t.beneficiary!.isNotEmpty)) {
      beneficiaryTotals[t.beneficiary!] = (beneficiaryTotals[t.beneficiary!] ?? 0) + t.amount;
      beneficiaryCounts[t.beneficiary!] = (beneficiaryCounts[t.beneficiary!] ?? 0) + 1;
    }
    final sorted = beneficiaryTotals.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    if (sorted.isEmpty) return const SizedBox();

    final display = sorted.take(4).toList();
    final colors = [_red, _orange, _purple, _blue, _green];

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Text('Người nhận', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _navy)),
            const SizedBox(width: 4),
            Icon(Icons.person_outline, size: 16, color: Colors.grey[400]),
            const Spacer(),
            GestureDetector(
              onTap: () => _openAllBeneficiaries(sorted, beneficiaryCounts),
              child: Text('Xem tất cả >', style: TextStyle(fontSize: 11, color: _purple, fontWeight: FontWeight.w500)),
            ),
          ]),
          const SizedBox(height: 14),
          Row(
            children: display.asMap().entries.map((e) {
              final color = colors[e.key % colors.length];
              return Expanded(
                child: GestureDetector(
                  onTap: () => _openBeneficiaryDetail(e.value.key),
                  child: Padding(
                    padding: EdgeInsets.only(right: e.key < display.length - 1 ? 8 : 0),
                    child: Column(children: [
                      CircleAvatar(
                        radius: 20,
                        backgroundColor: color.withOpacity(0.12),
                        child: Icon(Icons.person, size: 18, color: color),
                      ),
                      const SizedBox(height: 6),
                      Text(e.value.key, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: _navy), maxLines: 1, overflow: TextOverflow.ellipsis),
                      Text(_formatShort(e.value.value), style: TextStyle(fontSize: 10, color: Colors.grey[600])),
                    ]),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  void _openAllBeneficiaries(List<MapEntry<String, double>> sorted, Map<String, int> counts) {
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => _AllBeneficiariesScreen(
        beneficiaries: sorted,
        counts: counts,
        startDate: _startDate,
        endDate: _endDate,
      ),
    ));
  }

  void _openBeneficiaryDetail(String name) {
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => _BeneficiaryDetailScreen(
        name: name,
        startDate: _startDate,
        endDate: _endDate,
      ),
    ));
  }
}

// ─── All Expenses Screen ──────────────────────────────────────────────────

class _AllExpensesScreen extends StatelessWidget {
  final DateTime startDate;
  final DateTime endDate;
  const _AllExpensesScreen({required this.startDate, required this.endDate});

  @override
  Widget build(BuildContext context) {
    final nf = NumberFormat('#,###', 'vi_VN');
    final df = DateFormat('dd/MM/yyyy');

    return Scaffold(
      appBar: AppBar(title: const Text('Danh sách chi tiêu')),
      body: FutureBuilder<List<Transaction>>(
        future: context.read<TransactionProvider>().search(startDate: startDate, endDate: endDate),
        builder: (context, snapshot) {
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          final expenses = snapshot.data!.where((t) => t.type == 0).toList()..sort((a, b) => b.amount.compareTo(a.amount));
          if (expenses.isEmpty) return const Center(child: Text('Không có giao dịch'));
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: expenses.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final t = expenses[i];
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  radius: 18,
                  backgroundColor: Colors.red.withOpacity(0.1),
                  child: Text('${i + 1}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.red)),
                ),
                title: Text(t.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text(df.format(t.date), style: Theme.of(context).textTheme.bodySmall),
                trailing: Text('${nf.format(t.amount.toInt())}đ', style: const TextStyle(fontWeight: FontWeight.w600)),
              );
            },
          );
        },
      ),
    );
  }
}

// ─── All Beneficiaries Screen ─────────────────────────────────────────────

class _AllBeneficiariesScreen extends StatelessWidget {
  final List<MapEntry<String, double>> beneficiaries;
  final Map<String, int> counts;
  final DateTime startDate;
  final DateTime endDate;
  const _AllBeneficiariesScreen({required this.beneficiaries, required this.counts, required this.startDate, required this.endDate});

  @override
  Widget build(BuildContext context) {
    final nf = NumberFormat('#,###', 'vi_VN');
    return Scaffold(
      appBar: AppBar(title: const Text('Tất cả người nhận')),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: beneficiaries.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, i) {
          final entry = beneficiaries[i];
          final count = counts[entry.key] ?? 0;
          return ListTile(
            contentPadding: EdgeInsets.zero,
            leading: CircleAvatar(
              backgroundColor: Colors.purple.withOpacity(0.1),
              child: const Icon(Icons.person, color: Colors.purple, size: 20),
            ),
            title: Text(entry.key, style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text('$count giao dịch', style: Theme.of(context).textTheme.bodySmall),
            trailing: Text('${nf.format(entry.value.toInt())}đ', style: const TextStyle(fontWeight: FontWeight.w600)),
            onTap: () {
              Navigator.push(context, MaterialPageRoute(
                builder: (_) => _BeneficiaryDetailScreen(name: entry.key, startDate: startDate, endDate: endDate),
              ));
            },
          );
        },
      ),
    );
  }
}

// ─── Beneficiary Detail Screen ────────────────────────────────────────────

class _BeneficiaryDetailScreen extends StatelessWidget {
  final String name;
  final DateTime startDate;
  final DateTime endDate;
  const _BeneficiaryDetailScreen({required this.name, required this.startDate, required this.endDate});

  @override
  Widget build(BuildContext context) {
    final nf = NumberFormat('#,###', 'vi_VN');
    final df = DateFormat('dd/MM/yyyy');

    return Scaffold(
      appBar: AppBar(title: Text(name)),
      body: FutureBuilder<List<Transaction>>(
        future: context.read<TransactionProvider>().search(startDate: startDate, endDate: endDate),
        builder: (context, snapshot) {
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          final txns = snapshot.data!.where((t) => t.beneficiary == name).toList()..sort((a, b) => b.date.compareTo(a.date));
          if (txns.isEmpty) return const Center(child: Text('Không có giao dịch'));
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: txns.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final t = txns[i];
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(t.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text('${df.format(t.date)} • ${t.moduleName ?? ''} • ${t.accountName ?? ''}', style: Theme.of(context).textTheme.bodySmall),
                trailing: Text('${nf.format(t.amount.toInt())}đ', style: TextStyle(fontWeight: FontWeight.w600, color: t.type == 0 ? Colors.red : Colors.green)),
              );
            },
          );
        },
      ),
    );
  }
}

// ─── Models ───────────────────────────────────────────────────────────────

enum _AlertType { creditCard, rental, warranty, recurring }

class _AlertItem {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final int daysLeft;
  final DateTime dueDate;
  final _AlertType type;
  final dynamic data;

  _AlertItem({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.daysLeft,
    required this.dueDate,
    required this.type,
    this.data,
  });
}
