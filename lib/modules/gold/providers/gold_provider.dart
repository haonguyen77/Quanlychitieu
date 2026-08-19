import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../../../database/database_helper.dart';
import '../../../repositories/record_repository.dart';
import '../../../services/auto_sync.dart';
import '../models/gold_models.dart';

class GoldProvider extends ChangeNotifier {
  List<GoldTransaction> _transactions = [];
  List<GoldPriceHistory> _priceHistory = [];
  List<GoldHolding> _holdings = [];
  bool _isLoading = false;

  List<GoldTransaction> get transactions => _transactions;
  List<GoldPriceHistory> get priceHistory => _priceHistory;
  List<GoldHolding> get holdings => _holdings;
  bool get isLoading => _isLoading;

  static const List<String> defaultGoldTypes = ['SJC', 'PNJ', '9999', 'Nhẫn', 'Khác'];
  static const List<String> defaultUnits = ['chi', 'luong', 'gram'];

  /// Total invested amount
  double get totalInvested => _holdings.fold(0.0, (sum, h) => sum + h.totalInvested);

  /// Total quantity in chỉ
  double get totalQuantityChi => _holdings.fold(0.0, (sum, h) => sum + h.quantity);

  /// Total current value
  double get totalCurrentValue => _holdings.fold(0.0, (sum, h) => sum + h.currentValue);

  /// Total profit/loss
  double get totalProfitLoss => _holdings.fold(0.0, (sum, h) => sum + h.profitLoss);

  // ===== TRANSACTIONS =====

  Future<void> loadTransactions() async {
    _isLoading = true;
    notifyListeners();

    final db = await DatabaseHelper.instance.database;

    // Query records table: module_id='mod_vang' OR linked_module_id='mod_vang'
    final rows = await db.rawQuery(
      "SELECT * FROM records WHERE (module_id = 'mod_vang' OR linked_module_id = 'mod_vang') AND is_deleted = 0 ORDER BY updated_at DESC",
    );

    _transactions = rows.map((row) {
      final values = RecordRepository.getValues(row);
      
      // Extract gold-specific fields (try mod_vang_ prefix first, then mod_chitieu_)
      String _find(String suffix) {
        // Try mod_vang_ prefix
        final vangKey = 'mod_vang_$suffix';
        if (values.containsKey(vangKey) && values[vangKey] != null && values[vangKey].toString().isNotEmpty) {
          return values[vangKey].toString();
        }
        // Try mod_chitieu_ prefix (linked records use chi tieu form)
        final ctKey = 'mod_chitieu_$suffix';
        if (values.containsKey(ctKey) && values[ctKey] != null && values[ctKey].toString().isNotEmpty) {
          return values[ctKey].toString();
        }
        return '';
      }

      double _findNum(String suffix) {
        final s = _find(suffix);
        if (s.isEmpty) return 0;
        return double.tryParse(s) ?? 0;
      }

      final typeStr = _find('type');
      final txType = (typeStr == 'sell' || typeStr == '1') ? 'sell' : 'buy';
      final goldType = _find('gold_type');
      final quantity = _findNum('quantity');
      final pricePerUnit = _findNum('price_per_unit');
      final totalAmount = _findNum('total_amount') != 0 
          ? _findNum('total_amount') 
          : (_findNum('amount') != 0 ? _findNum('amount') : pricePerUnit * quantity);
      
      String dateStr = _find('date');
      if (dateStr.isEmpty) dateStr = _find('order_date');
      DateTime date;
      try { date = DateTime.parse(dateStr); } catch (_) { date = DateTime.now(); }

      // Build title from values or use generic
      String title = _find('title');
      if (title.isEmpty) {
        title = '${txType == 'sell' ? 'Bán' : 'Mua'} ${goldType.isNotEmpty ? goldType : ''} ${quantity > 0 ? '${quantity}chỉ' : ''}'.trim();
      }

      return GoldTransaction(
        id: row['id'] as String,
        type: txType,
        goldType: goldType.isNotEmpty ? goldType : 'SJC',
        unit: 'chi',
        quantity: quantity,
        pricePerUnit: pricePerUnit,
        totalAmount: totalAmount,
        date: date,
        note: _find('note').isNotEmpty ? _find('note') : null,
        createdAt: DateTime.tryParse(row['created_at'] as String? ?? '') ?? DateTime.now(),
        updatedAt: DateTime.tryParse(row['updated_at'] as String? ?? '') ?? DateTime.now(),
      );
    }).toList();

    _transactions.sort((a, b) => b.date.compareTo(a.date));

    _isLoading = false;
    notifyListeners();
  }

  Future<void> addTransaction(GoldTransaction transaction) async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now().toIso8601String();
    final id = const Uuid().v4();
    final totalAmount = transaction.quantity * transaction.pricePerUnit;

    // Store in records table with mod_vang_ prefix (native gold format)
    final values = <String, dynamic>{
      'mod_vang_type': transaction.type,
      'mod_vang_gold_type': transaction.goldType,
      'mod_vang_quantity': transaction.quantity,
      'mod_vang_price_per_unit': transaction.pricePerUnit,
      'mod_vang_total_amount': totalAmount,
      'mod_vang_date': transaction.date.toIso8601String().substring(0, 10),
    };
    if (transaction.note != null && transaction.note!.isNotEmpty) {
      values['mod_vang_note'] = transaction.note;
    }

    await db.insert('records', {
      'id': id,
      'module_id': 'mod_vang',
      'linked_module_id': null,
      'category_id': null,
      'values_json': jsonEncode(values),
      'tags_json': null,
      'images_json': null,
      'is_deleted': 0,
      'deleted_at': null,
      'created_at': now,
      'updated_at': now,
    });

    await loadTransactions();
    await loadHoldings();
    AutoSync.instance.notifyDataChanged();
  }

  Future<void> updateTransaction(GoldTransaction transaction) async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now().toIso8601String();
    final totalAmount = transaction.quantity * transaction.pricePerUnit;

    final values = <String, dynamic>{
      'mod_vang_type': transaction.type,
      'mod_vang_gold_type': transaction.goldType,
      'mod_vang_quantity': transaction.quantity,
      'mod_vang_price_per_unit': transaction.pricePerUnit,
      'mod_vang_total_amount': totalAmount,
      'mod_vang_date': transaction.date.toIso8601String().substring(0, 10),
    };
    if (transaction.note != null && transaction.note!.isNotEmpty) {
      values['mod_vang_note'] = transaction.note;
    }

    await db.update('records', {
      'values_json': jsonEncode(values),
      'updated_at': now,
    }, where: 'id = ?', whereArgs: [transaction.id]);

    await loadTransactions();
    await loadHoldings();
    AutoSync.instance.notifyDataChanged();
  }

  Future<void> deleteTransaction(String id) async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now().toIso8601String();
    await db.update('records', {
      'is_deleted': 1,
      'deleted_at': now,
      'updated_at': now,
    }, where: 'id = ?', whereArgs: [id]);

    await loadTransactions();
    await loadHoldings();
    AutoSync.instance.notifyDataChanged();
  }

  // ===== HOLDINGS =====

  Future<void> loadHoldings() async {
    // Calculate holdings from transactions
    Map<String, double> buyQty = {};
    Map<String, double> sellQty = {};
    Map<String, double> buyAmount = {};

    for (final t in _transactions) {
      if (t.type == 'buy') {
        buyQty[t.goldType] = (buyQty[t.goldType] ?? 0) + t.quantity;
        buyAmount[t.goldType] = (buyAmount[t.goldType] ?? 0) + t.totalAmount;
      } else {
        sellQty[t.goldType] = (sellQty[t.goldType] ?? 0) + t.quantity;
      }
    }

    List<GoldHolding> holdingsList = [];
    final allTypes = {...buyQty.keys, ...sellQty.keys};

    for (final goldType in allTypes) {
      final netQty = (buyQty[goldType] ?? 0) - (sellQty[goldType] ?? 0);
      if (netQty <= 0) continue;

      final totalBuyAmount = buyAmount[goldType] ?? 0;
      final totalBuyQty = buyQty[goldType] ?? 1;
      final avgBuyPrice = totalBuyAmount / totalBuyQty;

      // Get current price from price history
      final db = await DatabaseHelper.instance.database;
      final priceResult = await db.query(
        'gold_price_history',
        where: 'gold_type = ?',
        whereArgs: [goldType],
        orderBy: 'date DESC, created_at DESC',
        limit: 1,
      );

      // Note: gold_price_history table might not exist in new DB
      double currentPricePerChi = 0;
      if (priceResult.isNotEmpty) {
        final pricePerLuong = (priceResult.first['price'] as num?)?.toDouble() ?? 0;
        currentPricePerChi = pricePerLuong / 10;
      }

      final totalInvested = avgBuyPrice;
      final currentValue = currentPricePerChi * netQty;
      final profitLoss = currentValue - totalInvested;
      final profitLossPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0.0;

      holdingsList.add(GoldHolding(
        goldType: goldType,
        quantity: netQty,
        avgBuyPrice: avgBuyPrice / (totalBuyQty > 0 ? totalBuyQty : 1) * netQty == 0 ? avgBuyPrice : avgBuyPrice / totalBuyQty,
        currentPrice: currentPricePerChi,
        totalInvested: totalInvested,
        currentValue: currentValue,
        profitLoss: profitLoss,
        profitLossPercent: profitLossPercent,
      ));
    }

    _holdings = holdingsList;
    notifyListeners();
  }

  // ===== PRICE HISTORY =====

  Future<void> loadPriceHistory() async {
    // Gold price history uses a separate lightweight table (not part of records)
    // For now just keep empty — can be stored in app_data
    _priceHistory = [];
    notifyListeners();
  }

  Future<void> updateCurrentPrice(String goldType, double price) async {
    // Store in app_data as JSON
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now().toIso8601String();
    
    // Try to create gold_price_history table if not exists
    await db.execute('''
      CREATE TABLE IF NOT EXISTS gold_price_history (
        id TEXT PRIMARY KEY,
        gold_type TEXT NOT NULL,
        price REAL NOT NULL,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    ''');

    await db.insert('gold_price_history', {
      'id': const Uuid().v4(),
      'gold_type': goldType,
      'price': price,
      'date': now.substring(0, 10),
      'created_at': now,
    });

    await loadPriceHistory();
    await loadHoldings();
  }

  Future<double> getLatestPrice(String goldType) async {
    final db = await DatabaseHelper.instance.database;
    try {
      final result = await db.query(
        'gold_price_history',
        where: 'gold_type = ?',
        whereArgs: [goldType],
        orderBy: 'date DESC, created_at DESC',
        limit: 1,
      );
      if (result.isEmpty) return 0;
      return (result.first['price'] as num?)?.toDouble() ?? 0;
    } catch (_) {
      return 0;
    }
  }

  List<GoldPriceHistory> getPriceHistoryByType(String goldType) {
    return _priceHistory.where((p) => p.goldType == goldType).toList();
  }

  // ===== REPORTS =====

  double getTotalValue() {
    return _holdings.fold(0.0, (sum, h) => sum + h.currentValue);
  }

  List<GoldHolding> getPortfolioSummary() {
    return _holdings;
  }

  Future<List<Map<String, dynamic>>> getMonthlyValues() async {
    return [];
  }
}
