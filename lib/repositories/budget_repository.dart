import 'package:uuid/uuid.dart';
import '../database/database_helper.dart';
import '../models/budget.dart';

class BudgetRepository {
  final _uuid = const Uuid();

  Future<List<Budget>> getAll({bool activeOnly = true}) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query(
      'budgets',
      where: activeOnly ? 'is_active = 1' : null,
      orderBy: 'created_at DESC',
    );

    final budgets = <Budget>[];
    for (final map in result) {
      final spent = await _getSpent(map);
      budgets.add(Budget.fromMap({...map, 'spent': spent}));
    }
    return budgets;
  }

  Future<double> _getSpent(Map<String, dynamic> budgetMap) async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now();
    final period = budgetMap['period'] as String? ?? 'monthly';

    DateTime startDate;
    switch (period) {
      case 'weekly':
        startDate = now.subtract(Duration(days: now.weekday - 1));
        startDate = DateTime(startDate.year, startDate.month, startDate.day);
        break;
      case 'yearly':
        startDate = DateTime(now.year, 1, 1);
        break;
      case 'monthly':
      default:
        startDate = DateTime(now.year, now.month, 1);
        break;
    }

    String where = 'type = 0 AND is_deleted = 0 AND date >= ?';
    List<dynamic> whereArgs = [startDate.toIso8601String()];

    if (budgetMap['category_id'] != null) {
      where += ' AND category_id = ?';
      whereArgs.add(budgetMap['category_id']);
    }
    if (budgetMap['module_id'] != null) {
      where += ' AND module_id = ?';
      whereArgs.add(budgetMap['module_id']);
    }

    final result = await db.rawQuery('''
      SELECT SUM(amount) as total FROM transactions WHERE $where
    ''', whereArgs);

    return (result.first['total'] as num?)?.toDouble() ?? 0;
  }

  Future<Budget?> getById(String id) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query(
      'budgets',
      where: 'id = ?',
      whereArgs: [id],
    );

    if (result.isEmpty) return null;
    final spent = await _getSpent(result.first);
    return Budget.fromMap({...result.first, 'spent': spent});
  }

  Future<Budget> insert(Budget budget) async {
    final db = await DatabaseHelper.instance.database;
    final id = budget.id.isEmpty ? _uuid.v4() : budget.id;
    final now = DateTime.now();

    final newBudget = budget.copyWith(
      id: id,
      createdAt: now,
      updatedAt: now,
    );

    await db.insert('budgets', newBudget.toMap());
    return newBudget;
  }

  Future<void> update(Budget budget) async {
    final db = await DatabaseHelper.instance.database;
    final updated = budget.copyWith(updatedAt: DateTime.now());
    await db.update(
      'budgets',
      updated.toMap(),
      where: 'id = ?',
      whereArgs: [budget.id],
    );
  }

  Future<void> delete(String id) async {
    final db = await DatabaseHelper.instance.database;
    await db.delete('budgets', where: 'id = ?', whereArgs: [id]);
  }

  Future<List<Budget>> getWarnings() async {
    final budgets = await getAll();
    return budgets.where((b) => b.isNearLimit || b.isOverBudget).toList();
  }
}
