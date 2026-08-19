import 'package:flutter/foundation.dart';
import '../models/account.dart';
import '../database/database_helper.dart';

/// AccountProvider — reads accounts from the new unified DB (synced from EXT).
class AccountProvider extends ChangeNotifier {
  List<Account> _accounts = [];
  double _totalBalance = 0;
  bool _isLoading = false;

  List<Account> get accounts => _accounts;
  double get totalBalance => _totalBalance;
  bool get isLoading => _isLoading;

  Future<void> loadAccounts() async {
    _isLoading = true;
    notifyListeners();

    final db = await DatabaseHelper.instance.database;
    final rows = await db.query('accounts', where: 'is_active = 1', orderBy: 'sort_order ASC');

    _accounts = rows.map((row) => Account(
      id: row['id'] as String,
      name: row['name'] as String? ?? '',
      icon: row['icon'] as String? ?? 'wallet',
      color: row['color'] as String? ?? '#2196F3',
      initialBalance: (row['initial_balance'] as num?)?.toDouble() ?? 0,
      currentBalance: (row['current_balance'] as num?)?.toDouble() ?? 0,
      includeInTotal: (row['include_in_total'] as int? ?? 1) == 1,
      isActive: true,
      sortOrder: row['sort_order'] as int? ?? 0,
      createdAt: DateTime.tryParse(row['created_at'] as String? ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(row['updated_at'] as String? ?? '') ?? DateTime.now(),
    )).toList();

    _totalBalance = _accounts
        .where((a) => a.includeInTotal)
        .fold(0.0, (sum, a) => sum + a.currentBalance);

    _isLoading = false;
    notifyListeners();
  }

  Account? getAccountById(String id) {
    try { return _accounts.firstWhere((a) => a.id == id); } catch (_) { return null; }
  }

  Future<Account> addAccount(Account account) async {
    final db = await DatabaseHelper.instance.database;
    await db.insert('accounts', {
      'id': account.id,
      'name': account.name,
      'icon': account.icon,
      'color': account.color,
      'initial_balance': account.initialBalance,
      'current_balance': account.currentBalance,
      'include_in_total': account.includeInTotal ? 1 : 0,
      'is_active': 1,
      'sort_order': account.sortOrder,
      'created_at': DateTime.now().toIso8601String(),
      'updated_at': DateTime.now().toIso8601String(),
    });
    await loadAccounts();
    return account;
  }

  Future<void> updateAccount(Account account) async {
    final db = await DatabaseHelper.instance.database;
    await db.update('accounts', {
      'name': account.name,
      'icon': account.icon,
      'color': account.color,
      'initial_balance': account.initialBalance,
      'current_balance': account.currentBalance,
      'include_in_total': account.includeInTotal ? 1 : 0,
      'sort_order': account.sortOrder,
      'updated_at': DateTime.now().toIso8601String(),
    }, where: 'id = ?', whereArgs: [account.id]);
    await loadAccounts();
  }

  Future<void> deleteAccount(String id) async {
    final db = await DatabaseHelper.instance.database;
    await db.update('accounts', {'is_active': 0, 'updated_at': DateTime.now().toIso8601String()},
        where: 'id = ?', whereArgs: [id]);
    await loadAccounts();
  }

  Future<void> transfer({required String fromAccountId, required String toAccountId, required double amount, String? note}) async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now().toIso8601String();
    await db.rawUpdate('UPDATE accounts SET current_balance = current_balance - ?, updated_at = ? WHERE id = ?', [amount, now, fromAccountId]);
    await db.rawUpdate('UPDATE accounts SET current_balance = current_balance + ?, updated_at = ? WHERE id = ?', [amount, now, toAccountId]);
    await loadAccounts();
  }
}
