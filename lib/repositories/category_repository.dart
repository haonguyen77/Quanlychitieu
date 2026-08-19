import 'package:uuid/uuid.dart';
import '../database/database_helper.dart';
import '../models/category.dart';

class CategoryRepository {
  final _uuid = const Uuid();

  Future<List<Category>> getAll({int? type, bool activeOnly = true}) async {
    final db = await DatabaseHelper.instance.database;
    String where = '';
    List<dynamic> whereArgs = [];

    if (activeOnly) {
      where = 'is_active = 1';
    }
    if (type != null) {
      where += where.isNotEmpty ? ' AND ' : '';
      where += 'type = ?';
      whereArgs.add(type);
    }

    final result = await db.query(
      'categories',
      where: where.isNotEmpty ? where : null,
      whereArgs: whereArgs.isNotEmpty ? whereArgs : null,
      orderBy: 'sort_order ASC, name ASC',
    );

    return result.map((map) => Category.fromMap(map)).toList();
  }

  Future<List<Category>> getParentCategories({int? type}) async {
    final db = await DatabaseHelper.instance.database;
    String where = 'parent_id IS NULL AND is_active = 1';
    List<dynamic> whereArgs = [];

    if (type != null) {
      where += ' AND type = ?';
      whereArgs.add(type);
    }

    final result = await db.query(
      'categories',
      where: where,
      whereArgs: whereArgs.isNotEmpty ? whereArgs : null,
      orderBy: 'sort_order ASC, name ASC',
    );

    return result.map((map) => Category.fromMap(map)).toList();
  }

  Future<List<Category>> getChildCategories(String parentId) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query(
      'categories',
      where: 'parent_id = ? AND is_active = 1',
      whereArgs: [parentId],
      orderBy: 'sort_order ASC, name ASC',
    );

    return result.map((map) => Category.fromMap(map)).toList();
  }

  /// Gets parent categories with their children nested
  Future<List<Category>> getCategoriesWithChildren({int? type}) async {
    final parents = await getParentCategories(type: type);
    final List<Category> result = [];

    for (final parent in parents) {
      final children = await getChildCategories(parent.id);
      result.add(parent.copyWith(children: children));
    }

    return result;
  }

  Future<Category?> getById(String id) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query(
      'categories',
      where: 'id = ?',
      whereArgs: [id],
    );

    if (result.isEmpty) return null;
    return Category.fromMap(result.first);
  }

  Future<Category> insert(Category category) async {
    final db = await DatabaseHelper.instance.database;
    final id = category.id.isEmpty ? _uuid.v4() : category.id;
    final now = DateTime.now();

    final newCategory = category.copyWith(
      id: id,
      createdAt: now,
      updatedAt: now,
    );

    await db.insert('categories', newCategory.toMap());
    return newCategory;
  }

  Future<void> update(Category category) async {
    final db = await DatabaseHelper.instance.database;
    final updated = category.copyWith(updatedAt: DateTime.now());
    await db.update(
      'categories',
      updated.toMap(),
      where: 'id = ?',
      whereArgs: [category.id],
    );
  }

  Future<void> delete(String id) async {
    final db = await DatabaseHelper.instance.database;
    // Soft delete - set inactive
    await db.update(
      'categories',
      {'is_active': 0, 'updated_at': DateTime.now().toIso8601String()},
      where: 'id = ?',
      whereArgs: [id],
    );
    // Also deactivate children
    await db.update(
      'categories',
      {'is_active': 0, 'updated_at': DateTime.now().toIso8601String()},
      where: 'parent_id = ?',
      whereArgs: [id],
    );
  }

  Future<void> reorder(List<Category> categories) async {
    final db = await DatabaseHelper.instance.database;
    final batch = db.batch();
    for (int i = 0; i < categories.length; i++) {
      batch.update(
        'categories',
        {'sort_order': i},
        where: 'id = ?',
        whereArgs: [categories[i].id],
      );
    }
    await batch.commit(noResult: true);
  }
}
