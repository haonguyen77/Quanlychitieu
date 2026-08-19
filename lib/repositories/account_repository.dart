import 'package:uuid/uuid.dart';
import '../database/database_helper.dart';
import '../models/account.dart';
import '../models/transfer.dart';

class AccountRepository {
  final _uuid = const Uuid();

  Future<List<Account>> getAll({bool activeOnly = true}) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query(
      'accounts',
      where: activeOnly ? 'is_active = 1' : null,
      orderBy: 'sort_order ASC, name ASC',
    );

    return result.map((map) => Account.fromMap(map)).toList();
  }

  Future<Account?> getById(String id) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query(
      'accounts',
      where: 'id = ?',
      whereArgs: [id],
    );

    if (result.isEmpty) return null;
    return Account.fromMap(result.first);
  }

  Future<double> getTotalBalance() async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.rawQuery('''
      SELECT SUM(current_balance) as total
      FROM accounts
      WHERE is_active = 1 AND include_in_total = 1
    ''');

    return (result.first['total'] as num?)?.toDouble() ?? 0;
  }

  Future<Account> insert(Account account) async {
    final db = await DatabaseHelper.instance.database;
    final id = account.id.isEmpty ? _uuid.v4() : account.id;
    final now = DateTime.now();

    final newAccount = account.copyWith(
      id: id,
      currentBalance: account.initialBalance,
      createdAt: now,
      updatedAt: now,
    );

    await db.insert('accounts', newAccount.toMap());
    return newAccount;
  }

  Future<void> update(Account account) async {
    final db = await DatabaseHelper.instance.database;
    final updated = account.copyWith(updatedAt: DateTime.now());
    await db.update(
      'accounts',
      updated.toMap(),
      where: 'id = ?',
      whereArgs: [account.id],
    );
  }

  Future<void> delete(String id) async {
    final db = await DatabaseHelper.instance.database;
    await db.update(
      'accounts',
      {'is_active': 0, 'updated_at': DateTime.now().toIso8601String()},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<void> updateBalance(String id, double newBalance) async {
    final db = await DatabaseHelper.instance.database;
    await db.update(
      'accounts',
      {
        'current_balance': newBalance,
        'updated_at': DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  // Transfer between accounts
  Future<Transfer> transfer({
    required String fromAccountId,
    required String toAccountId,
    required double amount,
    String? note,
    DateTime? date,
  }) async {
    final db = await DatabaseHelper.instance.database;
    final id = _uuid.v4();
    final now = DateTime.now();
    final transferDate = date ?? now;

    final transfer = Transfer(
      id: id,
      fromAccountId: fromAccountId,
      toAccountId: toAccountId,
      amount: amount,
      note: note,
      date: transferDate,
      createdAt: now,
    );

    await db.insert('transfers', transfer.toMap());

    // Update balances
    await db.rawUpdate('''
      UPDATE accounts SET current_balance = current_balance - ?, updated_at = ?
      WHERE id = ?
    ''', [amount, now.toIso8601String(), fromAccountId]);

    await db.rawUpdate('''
      UPDATE accounts SET current_balance = current_balance + ?, updated_at = ?
      WHERE id = ?
    ''', [amount, now.toIso8601String(), toAccountId]);

    return transfer;
  }

  Future<List<Transfer>> getTransfers({int? limit}) async {
    final db = await DatabaseHelper.instance.database;
    final limitClause = limit != null ? 'LIMIT $limit' : '';

    final result = await db.rawQuery('''
      SELECT t.*,
        fa.name as from_account_name,
        ta.name as to_account_name
      FROM transfers t
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      ORDER BY t.date DESC
      $limitClause
    ''');

    return result.map((map) => Transfer.fromMap(map)).toList();
  }

  Future<void> reorder(List<Account> accounts) async {
    final db = await DatabaseHelper.instance.database;
    final batch = db.batch();
    for (int i = 0; i < accounts.length; i++) {
      batch.update(
        'accounts',
        {'sort_order': i},
        where: 'id = ?',
        whereArgs: [accounts[i].id],
      );
    }
    await batch.commit(noResult: true);
  }
}
