import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../../../database/database_helper.dart';
import '../../../models/transaction.dart';
import '../../../services/auto_sync.dart';
import '../models/credit_card.dart';

class CreditCardProvider extends ChangeNotifier {
  final _uuid = const Uuid();

  List<CreditCard> _cards = [];
  List<Transaction> _transactions = [];
  bool _isLoading = false;
  String? _selectedCardId;

  List<CreditCard> get cards => _cards;
  List<Transaction> get transactions => _transactions;
  bool get isLoading => _isLoading;
  String? get selectedCardId => _selectedCardId;

  CreditCard? get selectedCard {
    if (_selectedCardId == null) return _cards.isNotEmpty ? _cards.first : null;
    return _cards.where((c) => c.id == _selectedCardId).firstOrNull;
  }

  double get totalDebt => _cards.fold(0.0, (sum, c) => sum + (c.currentDebt ?? 0));

  Future<void> loadCards() async {
    _isLoading = true;
    notifyListeners();

    final db = await DatabaseHelper.instance.database;
    final result = await db.query('credit_cards', where: 'is_active = 1', orderBy: 'name ASC');

    final cards = <CreditCard>[];
    for (final map in result) {
      final cardId = map['id'] as String;
      final accountId = 'acc_cc_$cardId';
      final stmtDay = map['statement_day'] as int? ?? 20;

      // Calculate statement period
      final now = DateTime.now();
      final thisMonthStmt = DateTime(now.year, now.month, stmtDay);
      DateTime periodStart;
      DateTime periodEnd;
      if (now.isAfter(thisMonthStmt)) {
        periodStart = DateTime(now.year, now.month, stmtDay + 1);
        periodEnd = DateTime(now.year, now.month + 1, stmtDay, 23, 59, 59);
      } else {
        periodStart = DateTime(now.year, now.month - 1, stmtDay + 1);
        periodEnd = DateTime(now.year, now.month, stmtDay, 23, 59, 59);
      }

      // Calculate debt from main transactions table (chi tiêu in this period)
      final debtResult = await db.rawQuery('''
        SELECT COALESCE(SUM(CASE WHEN type = 0 THEN amount WHEN type = 2 THEN -amount ELSE 0 END), 0) as debt
        FROM transactions
        WHERE account_id = ? AND is_deleted = 0
          AND date >= ? AND date <= ?
      ''', [accountId, periodStart.toIso8601String(), periodEnd.toIso8601String()]);
      final debt = (debtResult.first['debt'] as num?)?.toDouble() ?? 0;
      final limit = (map['credit_limit'] as num?)?.toDouble() ?? 0;

      cards.add(CreditCard.fromMap({...map, 'current_debt': debt, 'available_credit': limit - debt}));
    }

    _cards = cards;
    _isLoading = false;
    notifyListeners();
  }

  Future<void> selectCard(String cardId) async {
    _selectedCardId = cardId;
    await loadTransactionsForCard(cardId);
    notifyListeners();
  }

  Future<void> loadTransactionsForCard(String cardId, {DateTime? startDate, DateTime? endDate}) async {
    final db = await DatabaseHelper.instance.database;
    final accountId = 'acc_cc_$cardId';

    List<dynamic> whereArgs = [accountId];

    if (startDate != null) {
      whereArgs.add(startDate.toIso8601String());
    }
    if (endDate != null) {
      whereArgs.add(endDate.toIso8601String());
    }

    final result = await db.rawQuery('''
      SELECT t.*, c.name as category_name, a.name as account_name, m.name as module_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN modules m ON t.module_id = m.id
      WHERE t.account_id = ? AND t.is_deleted = 0
      ${startDate != null ? 'AND t.date >= ?' : ''}
      ${endDate != null ? 'AND t.date <= ?' : ''}
      ORDER BY t.date DESC
    ''', whereArgs);

    _transactions = result.map((m) => Transaction.fromMap(m)).toList();
    notifyListeners();
  }

  Future<void> addCard(CreditCard card) async {
    final db = await DatabaseHelper.instance.database;
    await db.insert('credit_cards', card.toMap());

    // Auto-create matching Account so the card shows in transaction account picker
    final accountId = 'acc_cc_${card.id}';
    final existingAccount = await db.query('accounts', where: 'id = ?', whereArgs: [accountId]);
    if (existingAccount.isEmpty) {
      final now = DateTime.now().toIso8601String();
      await db.insert('accounts', {
        'id': accountId,
        'name': card.name,
        'icon': 'card',
        'color': '#6C2BD9',
        'initial_balance': 0.0,
        'current_balance': 0.0,
        'include_in_total': 0,
        'is_active': 1,
        'sort_order': 99,
        'created_at': now,
        'updated_at': now,
      });
    }

    await loadCards();
  }

  Future<void> updateCard(CreditCard card) async {
    final db = await DatabaseHelper.instance.database;
    final updated = card.copyWith(updatedAt: DateTime.now());
    await db.update('credit_cards', updated.toMap(), where: 'id = ?', whereArgs: [card.id]);

    // Update matching account name
    final accountId = 'acc_cc_${card.id}';
    await db.update('accounts', {'name': card.name, 'updated_at': DateTime.now().toIso8601String()}, where: 'id = ?', whereArgs: [accountId]);

    await loadCards();
  }

  Future<void> deleteCard(String id) async {
    final db = await DatabaseHelper.instance.database;
    await db.update('credit_cards', {'is_active': 0, 'updated_at': DateTime.now().toIso8601String()}, where: 'id = ?', whereArgs: [id]);
    // Also deactivate the linked account
    await db.update('accounts', {'is_active': 0, 'updated_at': DateTime.now().toIso8601String()}, where: 'id = ?', whereArgs: ['acc_cc_$id']);
    await loadCards();
    AutoSync.instance.notifyDataChanged();
  }

  /// Add a payment transaction (type=2) to reduce card debt
  Future<void> addPayment({
    required String cardId,
    required double amount,
    required String sourceAccountId,
    required DateTime date,
    String? note,
  }) async {
    final db = await DatabaseHelper.instance.database;
    final accountId = 'acc_cc_$cardId';
    final now = DateTime.now().toIso8601String();
    final id = _uuid.v4();

    // Create transaction with type=2 (credit card payment)
    await db.insert('transactions', {
      'id': id,
      'type': 2, // Credit card payment
      'amount': amount,
      'title': note ?? 'Thanh toán thẻ',
      'note': note,
      'account_id': accountId,
      'date': date.toIso8601String(),
      'is_deleted': 0,
      'created_at': now,
      'updated_at': now,
      'quantity': 1,
    });

    await loadCards();
    if (_selectedCardId != null) {
      await loadTransactionsForCard(_selectedCardId!);
    }
  }
}
