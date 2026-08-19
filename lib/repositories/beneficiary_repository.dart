import '../database/database_helper.dart';
import '../models/beneficiary.dart';

class BeneficiaryRepository {
  Future<List<Beneficiary>> getAll() async {
    final db = await DatabaseHelper.instance.database;
    final results = await db.query(
      'beneficiaries',
      orderBy: 'sort_order ASC, name ASC',
    );
    return results.map((m) => Beneficiary.fromMap(m)).toList();
  }

  Future<List<Beneficiary>> getActive() async {
    final db = await DatabaseHelper.instance.database;
    final results = await db.query(
      'beneficiaries',
      where: 'is_active = 1',
      orderBy: 'sort_order ASC, name ASC',
    );
    return results.map((m) => Beneficiary.fromMap(m)).toList();
  }

  Future<List<Beneficiary>> search(String query) async {
    final db = await DatabaseHelper.instance.database;
    final results = await db.query(
      'beneficiaries',
      where: 'name LIKE ?',
      whereArgs: ['%$query%'],
      orderBy: 'sort_order ASC, name ASC',
    );
    return results.map((m) => Beneficiary.fromMap(m)).toList();
  }

  Future<Beneficiary> insert(Beneficiary beneficiary) async {
    final db = await DatabaseHelper.instance.database;
    await db.insert('beneficiaries', beneficiary.toMap());
    return beneficiary;
  }

  Future<void> update(Beneficiary beneficiary) async {
    final db = await DatabaseHelper.instance.database;
    await db.update(
      'beneficiaries',
      beneficiary.copyWith(updatedAt: DateTime.now()).toMap(),
      where: 'id = ?',
      whereArgs: [beneficiary.id],
    );
  }

  Future<void> delete(String id) async {
    final db = await DatabaseHelper.instance.database;
    await db.delete('beneficiaries', where: 'id = ?', whereArgs: [id]);
  }

  Future<void> toggleActive(String id, bool isActive) async {
    final db = await DatabaseHelper.instance.database;
    await db.update(
      'beneficiaries',
      {'is_active': isActive ? 1 : 0, 'updated_at': DateTime.now().toIso8601String()},
      where: 'id = ?',
      whereArgs: [id],
    );
  }
}
