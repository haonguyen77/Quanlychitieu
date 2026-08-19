import 'package:uuid/uuid.dart';
import '../../../database/database_helper.dart';
import '../models/wine_customer.dart';

class WineCustomerRepository {
  final _uuid = const Uuid();

  Future<List<WineCustomer>> getAll({bool activeOnly = true}) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.rawQuery('''
      SELECT c.*,
        (SELECT COALESCE(SUM(total_amount), 0) FROM wine_sales_orders WHERE customer_id = c.id) as total_spent
      FROM wine_customers c
      ${activeOnly ? 'WHERE c.is_active = 1' : ''}
      ORDER BY c.name ASC
    ''');
    return result.map((m) => WineCustomer.fromMap(m)).toList();
  }

  Future<WineCustomer?> getById(String id) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query('wine_customers', where: 'id = ?', whereArgs: [id]);
    if (result.isEmpty) return null;
    return WineCustomer.fromMap(result.first);
  }

  Future<List<WineCustomer>> search(String keyword) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.rawQuery('''
      SELECT c.*,
        (SELECT COALESCE(SUM(total_amount), 0) FROM wine_sales_orders WHERE customer_id = c.id) as total_spent
      FROM wine_customers c
      WHERE c.is_active = 1 AND (c.name LIKE ? OR c.phone LIKE ? OR c.address LIKE ?)
      ORDER BY c.name ASC
    ''', ['%$keyword%', '%$keyword%', '%$keyword%']);
    return result.map((m) => WineCustomer.fromMap(m)).toList();
  }

  Future<WineCustomer> insert(WineCustomer customer) async {
    final db = await DatabaseHelper.instance.database;
    final id = customer.id.isEmpty ? _uuid.v4() : customer.id;
    final now = DateTime.now();
    final newCustomer = customer.copyWith(id: id, createdAt: now, updatedAt: now);
    await db.insert('wine_customers', newCustomer.toMap());
    return newCustomer;
  }

  Future<void> update(WineCustomer customer) async {
    final db = await DatabaseHelper.instance.database;
    final updated = customer.copyWith(updatedAt: DateTime.now());
    await db.update('wine_customers', updated.toMap(), where: 'id = ?', whereArgs: [customer.id]);
  }

  Future<void> delete(String id) async {
    final db = await DatabaseHelper.instance.database;
    await db.update('wine_customers', {'is_active': 0, 'updated_at': DateTime.now().toIso8601String()}, where: 'id = ?', whereArgs: [id]);
  }
}
