import 'dart:convert';
import 'package:uuid/uuid.dart';
import '../database/database_helper.dart';
import '../models/transaction.dart';

class TransactionRepository {
  final _uuid = const Uuid();

  Future<List<Transaction>> getAll({
    bool includeDeleted = false,
    String? moduleId,
    int? limit,
    int? offset,
  }) async {
    final db = await DatabaseHelper.instance.database;
    String where = '';
    List<dynamic> whereArgs = [];

    if (!includeDeleted) {
      where = 't.is_deleted = 0';
    }
    if (moduleId != null) {
      where += where.isNotEmpty ? ' AND ' : '';
      where += '(t.module_id = ? OR t.linked_module_id = ?)';
      whereArgs.add(moduleId);
      whereArgs.add(moduleId);
    }

    final whereClause = where.isNotEmpty ? 'WHERE $where' : '';
    final limitClause = limit != null ? 'LIMIT $limit' : '';
    final offsetClause = offset != null ? 'OFFSET $offset' : '';

    final result = await db.rawQuery('''
      SELECT t.*, 
        c.name as category_name,
        a.name as account_name,
        m.name as module_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN modules m ON t.module_id = m.id
      $whereClause
      ORDER BY t.date DESC, t.created_at DESC
      $limitClause $offsetClause
    ''', whereArgs);

    return result.map((map) => Transaction.fromMap(map)).toList();
  }

  Future<List<Transaction>> getByDateRange(
    DateTime startDate,
    DateTime endDate, {
    bool includeDeleted = false,
    String? moduleId,
    String? categoryId,
    String? accountId,
  }) async {
    final db = await DatabaseHelper.instance.database;
    String where = 't.date >= ? AND t.date <= ?';
    // So sánh date dạng YYYY-MM-DD (khớp với cách lưu trong DB).
    // KHÔNG dùng toIso8601String() vì "2026-09-01" < "2026-09-01T..." lexicographically
    // → ngày đầu tháng bị lọc mất.
    List<dynamic> whereArgs = [
      startDate.toIso8601String().substring(0, 10),
      endDate.toIso8601String().substring(0, 10),
    ];

    if (!includeDeleted) {
      where += ' AND t.is_deleted = 0';
    }
    if (moduleId != null) {
      where += ' AND (t.module_id = ? OR t.linked_module_id = ?)';
      whereArgs.add(moduleId);
      whereArgs.add(moduleId);
    }
    if (categoryId != null) {
      where += ' AND t.category_id = ?';
      whereArgs.add(categoryId);
    }
    if (accountId != null) {
      where += ' AND t.account_id = ?';
      whereArgs.add(accountId);
    }

    final result = await db.rawQuery('''
      SELECT t.*, 
        c.name as category_name,
        a.name as account_name,
        m.name as module_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN modules m ON t.module_id = m.id
      WHERE $where
      ORDER BY t.date DESC, t.created_at DESC
    ''', whereArgs);

    return result.map((map) => Transaction.fromMap(map)).toList();
  }

  Future<List<Transaction>> getToday() async {
    final now = DateTime.now();
    final startOfDay = DateTime(now.year, now.month, now.day);
    final endOfDay = startOfDay.add(const Duration(days: 1));
    return getByDateRange(startOfDay, endOfDay);
  }

  Future<Map<String, double>> getTodaySummary() async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now();
    final startOfDay = DateTime(now.year, now.month, now.day).toIso8601String();
    final endOfDay = DateTime(now.year, now.month, now.day + 1).toIso8601String();

    final result = await db.rawQuery('''
      SELECT type, SUM(amount) as total
      FROM transactions
      WHERE date >= ? AND date < ? AND is_deleted = 0
      GROUP BY type
    ''', [startOfDay, endOfDay]);

    double income = 0;
    double expense = 0;
    for (final row in result) {
      if (row['type'] == 1) {
        income = (row['total'] as num?)?.toDouble() ?? 0;
      } else if (row['type'] == 0) {
        expense = (row['total'] as num?)?.toDouble() ?? 0;
      }
      // type == 2 (credit card payment) is excluded from both income and expense
    }

    return {
      'income': income,
      'expense': expense,
      'balance': income - expense,
    };
  }

  Future<Transaction?> getById(String id) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.rawQuery('''
      SELECT t.*, 
        c.name as category_name,
        a.name as account_name,
        m.name as module_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN modules m ON t.module_id = m.id
      WHERE t.id = ?
    ''', [id]);

    if (result.isEmpty) return null;
    return Transaction.fromMap(result.first);
  }

  Future<Transaction> insert(Transaction transaction) async {
    final db = await DatabaseHelper.instance.database;
    final id = transaction.id.isEmpty ? _uuid.v4() : transaction.id;
    final now = DateTime.now();

    final newTransaction = transaction.copyWith(
      id: id,
      createdAt: now,
      updatedAt: now,
    );

    await db.insert('transactions', newTransaction.toMap());

    // Also create/update sync_records for sync export
    await _upsertSyncRecord(db, newTransaction);

    // Update account balance
    if (transaction.accountId != null) {
      await _updateAccountBalance(transaction.accountId!, transaction.amount,
          transaction.type == 1);

      // Auto-link to credit card if paid by credit card account
      if (transaction.type == 0) { // Only for expenses
        await _autoLinkCreditCard(db, transaction.accountId!, newTransaction);
      }
    }

    // Log activity
    await _logActivity('create', 'transaction', id, null, newTransaction.toMap());

    return newTransaction;
  }

  Future<void> update(Transaction transaction) async {
    final db = await DatabaseHelper.instance.database;

    // Get old transaction to reverse balance
    final oldTransaction = await getById(transaction.id);
    if (oldTransaction != null && oldTransaction.accountId != null) {
      await _updateAccountBalance(
          oldTransaction.accountId!, oldTransaction.amount, !oldTransaction.isIncome);

      // Remove old credit card link if account was a CC
      if (oldTransaction.accountId!.startsWith('acc_cc_')) {
        await db.delete('credit_card_transactions',
            where: 'title = ? AND amount = ? AND card_id = ?',
            whereArgs: [
              oldTransaction.title,
              oldTransaction.amount,
              oldTransaction.accountId!.substring(7),
            ]);
      }
    }

    final updated = transaction.copyWith(updatedAt: DateTime.now());
    await db.update(
      'transactions',
      updated.toMap(),
      where: 'id = ?',
      whereArgs: [transaction.id],
    );

    // Also update sync_records
    await _upsertSyncRecord(db, updated);

    // Apply new balance
    if (transaction.accountId != null) {
      await _updateAccountBalance(
          transaction.accountId!, transaction.amount, transaction.isIncome);

      // Auto-link to new credit card if applicable
      if (transaction.type == 0 && transaction.accountId!.startsWith('acc_cc_')) {
        await _autoLinkCreditCard(db, transaction.accountId!, updated);
      }
    }

    // Log activity
    await _logActivity(
        'update', 'transaction', transaction.id, oldTransaction?.toMap(), updated.toMap());
  }

  Future<void> softDelete(String id) async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now();

    final oldTransaction = await getById(id);
    if (oldTransaction != null && oldTransaction.accountId != null) {
      await _updateAccountBalance(
          oldTransaction.accountId!, oldTransaction.amount, !oldTransaction.isIncome);
    }

    await db.update(
      'transactions',
      {
        'is_deleted': 1,
        'deleted_at': now.toIso8601String(),
        'updated_at': now.toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );

    // Also mark deleted in sync_records
    await db.update(
      'sync_records',
      {
        'is_deleted': 1,
        'deleted_at': now.toIso8601String(),
        'updated_at': now.toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );

    // Also mark deleted in records table (used by sync export)
    await db.update(
      'records',
      {
        'is_deleted': 1,
        'deleted_at': now.toIso8601String(),
        'updated_at': now.toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );

    await _logActivity('delete', 'transaction', id, oldTransaction?.toMap(), null);
  }

  Future<void> restore(String id) async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now();

    await db.update(
      'transactions',
      {
        'is_deleted': 0,
        'deleted_at': null,
        'updated_at': now.toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );

    final restored = await getById(id);
    if (restored != null && restored.accountId != null) {
      await _updateAccountBalance(
          restored.accountId!, restored.amount, restored.isIncome);
    }

    await _logActivity('restore', 'transaction', id, null, restored?.toMap());
  }

  Future<void> permanentDelete(String id) async {
    final db = await DatabaseHelper.instance.database;
    await db.delete('transactions', where: 'id = ?', whereArgs: [id]);
    await db.delete('transaction_field_values',
        where: 'transaction_id = ?', whereArgs: [id]);
  }

  Future<List<Transaction>> getDeleted() async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.rawQuery('''
      SELECT t.*, 
        c.name as category_name,
        a.name as account_name,
        m.name as module_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN modules m ON t.module_id = m.id
      WHERE t.is_deleted = 1
      ORDER BY t.deleted_at DESC
    ''');

    return result.map((map) => Transaction.fromMap(map)).toList();
  }

  Future<List<Transaction>> search({
    String? keyword,
    DateTime? startDate,
    DateTime? endDate,
    double? minAmount,
    double? maxAmount,
    String? categoryId,
    String? moduleId,
    String? accountId,
    String? tag,
  }) async {
    final db = await DatabaseHelper.instance.database;
    String where = 't.is_deleted = 0';
    List<dynamic> whereArgs = [];

    if (keyword != null && keyword.isNotEmpty) {
      where += ' AND (t.title LIKE ? OR t.note LIKE ?)';
      whereArgs.addAll(['%$keyword%', '%$keyword%']);
    }
    if (startDate != null) {
      where += ' AND t.date >= ?';
      whereArgs.add(startDate.toIso8601String().substring(0, 10));
    }
    if (endDate != null) {
      where += ' AND t.date <= ?';
      whereArgs.add(endDate.toIso8601String().substring(0, 10));
    }
    if (minAmount != null) {
      where += ' AND t.amount >= ?';
      whereArgs.add(minAmount);
    }
    if (maxAmount != null) {
      where += ' AND t.amount <= ?';
      whereArgs.add(maxAmount);
    }
    if (categoryId != null) {
      where += ' AND t.category_id = ?';
      whereArgs.add(categoryId);
    }
    if (moduleId != null) {
      where += ' AND (t.module_id = ? OR t.linked_module_id = ?)';
      whereArgs.add(moduleId);
      whereArgs.add(moduleId);
    }
    if (accountId != null) {
      where += ' AND t.account_id = ?';
      whereArgs.add(accountId);
    }
    if (tag != null && tag.isNotEmpty) {
      where += ' AND t.tags LIKE ?';
      whereArgs.add('%$tag%');
    }

    final result = await db.rawQuery('''
      SELECT t.*, 
        c.name as category_name,
        a.name as account_name,
        m.name as module_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN modules m ON t.module_id = m.id
      WHERE $where
      ORDER BY t.date DESC
    ''', whereArgs);

    return result.map((map) => Transaction.fromMap(map)).toList();
  }

  /// Get title suggestions with their most-used category_id
  /// Returns list of maps: {title, category_id, count}
  Future<List<Map<String, dynamic>>> getTitleSuggestions(String query) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.rawQuery('''
      SELECT title, category_id, COUNT(*) as cnt
      FROM transactions
      WHERE is_deleted = 0 AND title LIKE ? AND type = 0
      GROUP BY title, category_id
      ORDER BY cnt DESC
      LIMIT 10
    ''', ['%$query%']);
    return result;
  }

  /// Get distinct titles with their most frequent category
  Future<List<Map<String, dynamic>>> getDistinctTitleCategories() async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.rawQuery('''
      SELECT title, category_id, COUNT(*) as cnt
      FROM transactions
      WHERE is_deleted = 0 AND type = 0
      GROUP BY title, category_id
      ORDER BY cnt DESC
      LIMIT 100
    ''');
    return result;
  }

  // Field values for dynamic modules
  Future<void> saveFieldValues(
      String transactionId, Map<String, String> fieldValues) async {
    final db = await DatabaseHelper.instance.database;

    // Delete existing values
    await db.delete('transaction_field_values',
        where: 'transaction_id = ?', whereArgs: [transactionId]);

    // Insert new values
    for (final entry in fieldValues.entries) {
      await db.insert('transaction_field_values', {
        'id': _uuid.v4(),
        'transaction_id': transactionId,
        'field_id': entry.key,
        'value': entry.value,
      });
    }
  }

  Future<Map<String, String>> getFieldValues(String transactionId) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query(
      'transaction_field_values',
      where: 'transaction_id = ?',
      whereArgs: [transactionId],
    );

    final map = <String, String>{};
    for (final row in result) {
      map[row['field_id'] as String] = row['value'] as String? ?? '';
    }
    return map;
  }

  // Private helpers

  /// Auto-link expense to credit card when paid by credit card account
  Future<void> _autoLinkCreditCard(dynamic db, String accountId, Transaction transaction) async {
    // Check if this account is a credit card account (ID starts with acc_cc_)
    if (!accountId.startsWith('acc_cc_')) return;

    // Extract card ID from account ID (format: acc_cc_[cardId])
    final cardId = accountId.substring(7); // remove 'acc_cc_'

    // Verify card exists
    final cardResult = await db.query('credit_cards', where: 'id = ? AND is_active = 1', whereArgs: [cardId]);
    if (cardResult.isEmpty) return;

    // Create credit card transaction
    await db.insert('credit_card_transactions', {
      'id': _uuid.v4(),
      'card_id': cardId,
      'amount': transaction.amount,
      'title': transaction.title,
      'note': transaction.note,
      'date': transaction.date.toIso8601String(),
      'type': 'expense',
      'installment_months': null,
      'installment_current': null,
      'installment_monthly': null,
      'is_paid': 0,
      'created_at': DateTime.now().toIso8601String(),
    });
  }

  Future<void> _updateAccountBalance(
      String accountId, double amount, bool isAdd) async {
    final db = await DatabaseHelper.instance.database;
    final operator = isAdd ? '+' : '-';
    await db.rawUpdate('''
      UPDATE accounts 
      SET current_balance = current_balance $operator ?,
          updated_at = ?
      WHERE id = ?
    ''', [amount, DateTime.now().toIso8601String(), accountId]);
  }

  Future<void> _logActivity(String action, String entityType, String entityId,
      Map<String, dynamic>? oldData, Map<String, dynamic>? newData) async {
    final db = await DatabaseHelper.instance.database;
    await db.insert('activity_log', {
      'id': _uuid.v4(),
      'action': action,
      'entity_type': entityType,
      'entity_id': entityId,
      'old_data': oldData != null ? jsonEncode(oldData) : null,
      'new_data': newData != null ? jsonEncode(newData) : null,
      'created_at': DateTime.now().toIso8601String(),
    });
  }

  /// Create/update sync_records entry for a transaction (for sync export)
  Future<void> _upsertSyncRecord(dynamic db, Transaction t) async {
    final moduleId = t.moduleId ?? 'mod_chitieu';
    final values = <String, dynamic>{};

    // EXT uses Chi tiêu form for linked modules (Shopee, Vàng, Nhà trọ)
    // So ALL transaction-type records use mod_chitieu_ prefix in values
    const prefix = 'mod_chitieu_';

    values['${prefix}title'] = t.title;
    values['${prefix}amount'] = t.amount;
    values['${prefix}type'] = t.type.toString();
    values['${prefix}date'] = t.date.toIso8601String().substring(0, 10);
    if (t.note != null) values['${prefix}note'] = t.note;
    if (t.beneficiary != null) values['${prefix}beneficiary'] = t.beneficiary;
    if (t.quantity != 1) values['${prefix}quantity'] = t.quantity;
    if (t.warrantyMonths != null) values['${prefix}warranty_months'] = t.warrantyMonths;
    if (t.warrantyDate != null) values['${prefix}warranty_date'] = t.warrantyDate!.toIso8601String().substring(0, 10);

    // Account reverse map
    if (t.accountId != null) {
      String accVal = t.accountId!;
      if (accVal == 'acc_cash') accVal = 'cash';
      else if (accVal == 'acc_bank') accVal = 'bank';
      else if (accVal == 'acc_momo') accVal = 'momo';
      else if (accVal == 'acc_tpbank') accVal = 'tpbank';
      else if (accVal == 'acc_vpbank') accVal = 'vpbank';
      else if (accVal == 'acc_zalopay') accVal = 'zalopay';
      else if (accVal == 'acc_credit') accVal = 'credit_card';
      else if (accVal.startsWith('acc_cc_')) accVal = 'credit_card_${accVal.replaceFirst('acc_cc_', '')}';
      values['${prefix}account'] = accVal;
    }

    // Gold (Vàng): WebApp/EXT render columns "Số lượng (chỉ)" and "Giá/chỉ" from
    // mod_vang_quantity and mod_vang_price_per_unit. The generic add screen only
    // fills mod_chitieu_* fields, so mirror the gold-specific keys here.
    // Rules (per product): số lượng chỉ = transaction quantity (min 1);
    // giá/chỉ = số tiền / số chỉ.
    if (moduleId == 'mod_vang') {
      final chi = t.quantity > 0 ? t.quantity : 1;
      values['mod_vang_quantity'] = chi;
      values['mod_vang_price_per_unit'] = t.amount / chi;
      values['mod_vang_total_amount'] = t.amount;
    }

    final tags = t.tags;
    final images = t.images;

    final record = {
      'id': t.id,
      'module_id': moduleId,
      'category_id': t.categoryId,
      'values_json': jsonEncode(values),
      'tags_json': (tags != null && tags.isNotEmpty) ? jsonEncode(tags.split(',').where((s) => s.isNotEmpty).toList()) : null,
      'images_json': (images != null && images.isNotEmpty) ? jsonEncode(images.split(',').where((s) => s.isNotEmpty).toList()) : null,
      'is_deleted': t.isDeleted ? 1 : 0,
      'deleted_at': null,
      'created_at': t.createdAt.toIso8601String(),
      'updated_at': t.updatedAt.toIso8601String(),
    };

    final existing = await db.query('sync_records', where: 'id = ?', whereArgs: [t.id]);
    if (existing.isEmpty) {
      await db.insert('sync_records', record);
    } else {
      await db.update('sync_records', record, where: 'id = ?', whereArgs: [t.id]);
    }

    // Also write to new 'records' table (used by exportFinanceJson for sync push)
    // Determine linkedModuleId: if module != mod_chitieu, it's a linked record
    String? linkedModuleId;
    const storedModuleId = 'mod_chitieu';
    if (moduleId != 'mod_chitieu') {
      linkedModuleId = moduleId;
    }
    final newRecord = {
      'id': t.id,
      'module_id': storedModuleId,
      'linked_module_id': linkedModuleId,
      'category_id': t.categoryId,
      'values_json': jsonEncode(values),
      'tags_json': record['tags_json'],
      'images_json': record['images_json'],
      'is_deleted': t.isDeleted ? 1 : 0,
      'deleted_at': null,
      'created_at': t.createdAt.toIso8601String(),
      'updated_at': t.updatedAt.toIso8601String(),
    };
    final existingNew = await db.query('records', where: 'id = ?', whereArgs: [t.id]);
    if (existingNew.isEmpty) {
      await db.insert('records', newRecord);
    } else {
      await db.update('records', newRecord, where: 'id = ?', whereArgs: [t.id]);
    }
  }
}
