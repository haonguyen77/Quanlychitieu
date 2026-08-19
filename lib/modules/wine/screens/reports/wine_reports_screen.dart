import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../database/database_helper.dart';

enum _FilterPeriod { month, year, all }

/// Wine Reports Screen — reads directly from `records` table (same source as WineDataProvider).
class WineReportsScreen extends StatefulWidget {
  const WineReportsScreen({super.key});

  @override
  State<WineReportsScreen> createState() => _WineReportsScreenState();
}

class _WineReportsScreenState extends State<WineReportsScreen> {
  static const _navy = Color(0xFF101B4D);
  static const _purple = Color(0xFF6C2BD9);
  static const _green = Color(0xFF16A34A);
  static const _orange = Color(0xFFEA580C);
  static const _blue = Color(0xFF2563EB);
  static const _red = Color(0xFFEF4444);
  static const _border = Color(0xFFE5E7EB);

  _FilterPeriod _currentPeriod = _FilterPeriod.month;
  DateTime _referenceDate = DateTime.now();

  // Data
  int _totalOrders = 0;
  double _totalRevenue = 0;
  int _totalProducts = 0;
  int _totalStock = 0;
  int _lowStockCount = 0;
  List<Map<String, dynamic>> _topProducts = [];
  List<Map<String, dynamic>> _topCustomers = [];
  List<Map<String, dynamic>> _monthlyData = [];

  // Comparison
  double _prevRevenue = 0;
  int _prevOrders = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  String get _datePrefix {
    switch (_currentPeriod) {
      case _FilterPeriod.month:
        return '${_referenceDate.year}-${_referenceDate.month.toString().padLeft(2, '0')}';
      case _FilterPeriod.year:
        return '${_referenceDate.year}';
      case _FilterPeriod.all:
        return '';
    }
  }

  String get _periodLabel {
    switch (_currentPeriod) {
      case _FilterPeriod.month:
        return 'T${_referenceDate.month}/${_referenceDate.year}';
      case _FilterPeriod.year:
        return '${_referenceDate.year}';
      case _FilterPeriod.all:
        return 'Tất cả';
    }
  }

  Future<void> _loadData() async {
    final db = await DatabaseHelper.instance.database;

    // Load all wine orders from records table
    final allOrders = await db.rawQuery(
      "SELECT values_json FROM records WHERE module_id = 'mod_ruou' AND is_deleted = 0"
    );

    // Parse orders
    final orders = allOrders.map((row) {
      try {
        return jsonDecode(row['values_json'] as String? ?? '{}') as Map<String, dynamic>;
      } catch (_) {
        return <String, dynamic>{};
      }
    }).toList();

    // Filter by period
    final prefix = _datePrefix;
    final periodOrders = prefix.isEmpty
        ? orders
        : orders.where((o) {
            final date = o['mod_ruou_order_date'] as String? ?? '';
            return date.startsWith(prefix);
          }).toList();

    // Stats
    _totalOrders = periodOrders.length;
    _totalRevenue = 0;
    final productMap = <String, int>{};
    final customerMap = <String, double>{};

    for (final o in periodOrders) {
      final amount = _toDouble(o['mod_ruou_total_amount']);
      final qty = _toInt(o['mod_ruou_quantity']);
      final productName = o['mod_ruou_product_name'] as String? ?? '';
      final customerName = o['mod_ruou_customer_name'] as String? ?? '';

      _totalRevenue += amount;
      if (productName.isNotEmpty) {
        productMap[productName] = (productMap[productName] ?? 0) + qty;
      }
      if (customerName.isNotEmpty) {
        customerMap[customerName] = (customerMap[customerName] ?? 0) + amount;
      }
    }

    // Top products
    final productEntries = productMap.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    _topProducts = productEntries.take(5).map((e) => {'name': e.key, 'qty': e.value}).toList();

    // Top customers
    final customerEntries = customerMap.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    _topCustomers = customerEntries.take(5).map((e) => {'name': e.key, 'revenue': e.value}).toList();

    // Previous period comparison
    String prevPrefix;
    if (_currentPeriod == _FilterPeriod.month) {
      final pm = _referenceDate.month == 1 ? 12 : _referenceDate.month - 1;
      final py = _referenceDate.month == 1 ? _referenceDate.year - 1 : _referenceDate.year;
      prevPrefix = '$py-${pm.toString().padLeft(2, '0')}';
    } else if (_currentPeriod == _FilterPeriod.year) {
      prevPrefix = '${_referenceDate.year - 1}';
    } else {
      prevPrefix = '___'; // won't match
    }
    final prevOrders = orders.where((o) {
      final date = o['mod_ruou_order_date'] as String? ?? '';
      return date.startsWith(prevPrefix);
    }).toList();
    _prevOrders = prevOrders.length;
    _prevRevenue = prevOrders.fold<double>(0, (s, o) => s + _toDouble(o['mod_ruou_total_amount']));

    // Monthly data (last 6 months)
    _monthlyData = [];
    final now = DateTime.now();
    for (int i = 5; i >= 0; i--) {
      final m = DateTime(now.year, now.month - i, 1);
      final mp = '${m.year}-${m.month.toString().padLeft(2, '0')}';
      final mOrders = orders.where((o) => (o['mod_ruou_order_date'] as String? ?? '').startsWith(mp)).toList();
      final mRevenue = mOrders.fold<double>(0, (s, o) => s + _toDouble(o['mod_ruou_total_amount']));
      _monthlyData.add({'month': 'T${m.month}', 'revenue': mRevenue, 'orders': mOrders.length});
    }

    // Inventory stats
    final invRows = await db.rawQuery(
      "SELECT values_json FROM records WHERE module_id = 'mod_ruou_inventory' AND is_deleted = 0"
    );
    _totalStock = 0;
    _lowStockCount = 0;
    _totalProducts = invRows.length;
    for (final row in invRows) {
      try {
        final v = jsonDecode(row['values_json'] as String? ?? '{}') as Map<String, dynamic>;
        final stock = _toInt(v['mod_ruou_inventory_stock']);
        _totalStock += stock;
        if (stock > 0 && stock <= 4) _lowStockCount++;
      } catch (_) {}
    }

    if (mounted) setState(() {});
  }

  double _toDouble(dynamic v) {
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  int _toInt(dynamic v) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v) ?? 0;
    return 0;
  }

  void _changePeriod(_FilterPeriod period) {
    setState(() { _currentPeriod = period; _referenceDate = DateTime.now(); });
    _loadData();
  }

  void _navigate(int direction) {
    setState(() {
      if (_currentPeriod == _FilterPeriod.month) {
        _referenceDate = DateTime(_referenceDate.year, _referenceDate.month + direction, 1);
      } else if (_currentPeriod == _FilterPeriod.year) {
        _referenceDate = DateTime(_referenceDate.year + direction, 1, 1);
      }
    });
    _loadData();
  }

  @override
  Widget build(BuildContext context) {
    final revenueGrowth = _prevRevenue > 0
        ? ((_totalRevenue - _prevRevenue) / _prevRevenue * 100).round()
        : 0;
    final orderDiff = _totalOrders - _prevOrders;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(children: [
                const Text('Báo cáo rượu', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _navy)),
                const Spacer(),
                Text(_periodLabel, style: TextStyle(fontSize: 13, color: Colors.grey[600])),
              ]),
            ),
            // Period filter
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(children: [
                GestureDetector(
                  onTap: () => _navigate(-1),
                  child: Container(
                    width: 32, height: 32,
                    decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: _border)),
                    child: const Icon(Icons.chevron_left, size: 18, color: _navy),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(child: _filterChip('Tháng', _FilterPeriod.month)),
                const SizedBox(width: 8),
                Expanded(child: _filterChip('Năm', _FilterPeriod.year)),
                const SizedBox(width: 8),
                Expanded(child: _filterChip('Tất cả', _FilterPeriod.all)),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => _navigate(1),
                  child: Container(
                    width: 32, height: 32,
                    decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: _border)),
                    child: const Icon(Icons.chevron_right, size: 18, color: _navy),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: 16),
            // Content
            Expanded(
              child: RefreshIndicator(
                onRefresh: _loadData,
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(children: [
                    // KPI cards
                    Row(children: [
                      Expanded(child: _kpiCard(Icons.receipt_long, 'Đơn hàng', '$_totalOrders',
                          '${orderDiff >= 0 ? '+' : ''}$orderDiff so kỳ trước', _purple)),
                      const SizedBox(width: 12),
                      Expanded(child: _kpiCard(Icons.trending_up, 'Doanh thu', _fmtMoney(_totalRevenue),
                          '${revenueGrowth >= 0 ? '+' : ''}$revenueGrowth%', _green)),
                    ]),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(child: _kpiCard(Icons.inventory_2, 'Tồn kho', '$_totalStock chai',
                          '$_totalProducts sản phẩm', _blue)),
                      const SizedBox(width: 12),
                      Expanded(child: _kpiCard(Icons.warning_amber, 'Sắp hết', '$_lowStockCount SP',
                          'Cần nhập hàng', _lowStockCount > 0 ? _orange : Colors.grey)),
                    ]),
                    const SizedBox(height: 20),
                    // Revenue chart
                    _buildRevenueChart(),
                    const SizedBox(height: 20),
                    // Top products
                    _buildTopProducts(),
                    const SizedBox(height: 20),
                    // Top customers
                    _buildTopCustomers(),
                    const SizedBox(height: 80),
                  ]),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _filterChip(String label, _FilterPeriod period) {
    final isSelected = _currentPeriod == period;
    return GestureDetector(
      onTap: () => _changePeriod(period),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? _purple : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? _purple : _border),
        ),
        child: Center(
          child: Text(label, style: TextStyle(
            fontSize: 13, fontWeight: FontWeight.w500,
            color: isSelected ? Colors.white : _navy,
          )),
        ),
      ),
    );
  }

  Widget _kpiCard(IconData icon, String title, String value, String subtitle, Color color) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _border),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 20, color: color),
          ),
          const Spacer(),
          Text(title, style: TextStyle(fontSize: 11, color: Colors.grey[600])),
        ]),
        const SizedBox(height: 10),
        Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 2),
        Text(subtitle, style: TextStyle(fontSize: 11, color: Colors.grey[500])),
      ]),
    );
  }

  Widget _buildRevenueChart() {
    if (_monthlyData.isEmpty) return const SizedBox();
    final maxRevenue = _monthlyData.fold<double>(0, (max, m) {
      final r = (m['revenue'] as double?) ?? 0;
      return r > max ? r : max;
    });

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white, borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Doanh thu 6 tháng gần nhất', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _navy)),
        const SizedBox(height: 16),
        SizedBox(
          height: 180,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: _monthlyData.map((m) {
              final revenue = (m['revenue'] as double?) ?? 0;
              final orders = (m['orders'] as int?) ?? 0;
              final pct = maxRevenue > 0 ? (revenue / maxRevenue) : 0.0;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      if (revenue > 0)
                        Text(_fmtShort(revenue), style: const TextStyle(fontSize: 8, color: _purple)),
                      if (orders > 0)
                        Text('$orders đơn', style: TextStyle(fontSize: 7, color: Colors.grey[500])),
                      const SizedBox(height: 4),
                      Container(
                        height: (pct * 100).clamp(revenue > 0 ? 4.0 : 0, 100),
                        decoration: BoxDecoration(
                          color: _purple.withOpacity(0.7),
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(m['month'] as String, style: const TextStyle(fontSize: 10, color: _navy)),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ]),
    );
  }

  Widget _buildTopProducts() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white, borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Sản phẩm bán chạy', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _navy)),
        const SizedBox(height: 12),
        if (_topProducts.isEmpty)
          Center(child: Padding(padding: const EdgeInsets.all(16), child: Text('Chưa có dữ liệu', style: TextStyle(color: Colors.grey[500]))))
        else
          ...List.generate(_topProducts.length, (i) {
            final p = _topProducts[i];
            final maxQty = (_topProducts.first['qty'] as int?) ?? 1;
            final qty = (p['qty'] as int?) ?? 0;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(children: [
                SizedBox(width: 20, child: Text('${i + 1}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey[600]))),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(p['name'] as String, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: _navy), overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: maxQty > 0 ? qty / maxQty : 0,
                        backgroundColor: Colors.grey[200],
                        valueColor: const AlwaysStoppedAnimation(_purple),
                        minHeight: 6,
                      ),
                    ),
                  ]),
                ),
                const SizedBox(width: 12),
                Text('$qty chai', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _purple)),
              ]),
            );
          }),
      ]),
    );
  }

  Widget _buildTopCustomers() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white, borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Khách hàng mua nhiều', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _navy)),
        const SizedBox(height: 12),
        if (_topCustomers.isEmpty)
          Center(child: Padding(padding: const EdgeInsets.all(16), child: Text('Chưa có dữ liệu', style: TextStyle(color: Colors.grey[500]))))
        else
          ...List.generate(_topCustomers.length, (i) {
            final c = _topCustomers[i];
            final revenue = (c['revenue'] as double?) ?? 0;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(children: [
                SizedBox(width: 20, child: Text('${i + 1}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey[600]))),
                const SizedBox(width: 8),
                Container(
                  width: 28, height: 28,
                  decoration: BoxDecoration(color: _blue.withOpacity(0.1), shape: BoxShape.circle),
                  child: Center(child: Text(
                    (c['name'] as String).isNotEmpty ? (c['name'] as String)[0].toUpperCase() : '?',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: _blue),
                  )),
                ),
                const SizedBox(width: 8),
                Expanded(child: Text(c['name'] as String, style: const TextStyle(fontSize: 12, color: _navy), overflow: TextOverflow.ellipsis)),
                Text(_fmtMoney(revenue), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _green)),
              ]),
            );
          }),
      ]),
    );
  }

  String _fmtMoney(double n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M₫';
    if (n >= 1000) return '${(n / 1000).round()}K₫';
    return '${n.round()}₫';
  }

  String _fmtShort(double n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).round()}K';
    return '${n.round()}';
  }
}
