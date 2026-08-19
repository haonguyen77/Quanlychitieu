import 'package:uuid/uuid.dart';
import '../database/database_helper.dart';
import '../models/app_module.dart';

class ModuleRepository {
  final _uuid = const Uuid();

  Future<List<AppModule>> getAll({bool activeOnly = true}) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query(
      'modules',
      where: activeOnly ? 'is_active = 1' : null,
      orderBy: 'sort_order ASC, name ASC',
    );

    return result.map((map) => AppModule.fromMap(map)).toList();
  }

  Future<AppModule?> getById(String id) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query(
      'modules',
      where: 'id = ?',
      whereArgs: [id],
    );

    if (result.isEmpty) return null;
    return AppModule.fromMap(result.first);
  }

  Future<AppModule> getWithFields(String id) async {
    final module = await getById(id);
    if (module == null) throw Exception('Module not found');

    final fields = await getModuleFields(id);
    return module.copyWith(fields: fields);
  }

  Future<AppModule> insert(AppModule module) async {
    final db = await DatabaseHelper.instance.database;
    final id = module.id.isEmpty ? _uuid.v4() : module.id;
    final now = DateTime.now();

    final newModule = module.copyWith(
      id: id,
      createdAt: now,
      updatedAt: now,
    );

    await db.insert('modules', newModule.toMap());
    return newModule;
  }

  Future<void> update(AppModule module) async {
    final db = await DatabaseHelper.instance.database;
    final updated = module.copyWith(updatedAt: DateTime.now());
    await db.update(
      'modules',
      updated.toMap(),
      where: 'id = ?',
      whereArgs: [module.id],
    );
  }

  Future<void> delete(String id) async {
    final db = await DatabaseHelper.instance.database;
    // Check if it's a default module
    final module = await getById(id);
    if (module != null && module.isDefault) {
      // Default modules can only be deactivated
      await db.update(
        'modules',
        {'is_active': 0, 'updated_at': DateTime.now().toIso8601String()},
        where: 'id = ?',
        whereArgs: [id],
      );
    } else {
      // Custom modules can be deleted
      await db.delete('module_fields', where: 'module_id = ?', whereArgs: [id]);
      await db.delete('modules', where: 'id = ?', whereArgs: [id]);
    }
  }

  // Module Fields
  Future<List<ModuleField>> getModuleFields(String moduleId) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query(
      'module_fields',
      where: 'module_id = ?',
      whereArgs: [moduleId],
      orderBy: 'sort_order ASC',
    );

    return result.map((map) => ModuleField.fromMap(map)).toList();
  }

  Future<ModuleField> insertField(ModuleField field) async {
    final db = await DatabaseHelper.instance.database;
    final id = field.id.isEmpty ? _uuid.v4() : field.id;
    final now = DateTime.now();

    final newField = field.copyWith(id: id, createdAt: now);
    await db.insert('module_fields', newField.toMap());
    return newField;
  }

  Future<void> updateField(ModuleField field) async {
    final db = await DatabaseHelper.instance.database;
    await db.update(
      'module_fields',
      field.toMap(),
      where: 'id = ?',
      whereArgs: [field.id],
    );
  }

  Future<void> deleteField(String fieldId) async {
    final db = await DatabaseHelper.instance.database;
    await db.delete('module_fields', where: 'id = ?', whereArgs: [fieldId]);
    // Also delete associated values
    await db.delete('transaction_field_values',
        where: 'field_id = ?', whereArgs: [fieldId]);
  }

  Future<void> reorderFields(List<ModuleField> fields) async {
    final db = await DatabaseHelper.instance.database;
    final batch = db.batch();
    for (int i = 0; i < fields.length; i++) {
      batch.update(
        'module_fields',
        {'sort_order': i},
        where: 'id = ?',
        whereArgs: [fields[i].id],
      );
    }
    await batch.commit(noResult: true);
  }

  Future<void> reorder(List<AppModule> modules) async {
    final db = await DatabaseHelper.instance.database;
    final batch = db.batch();
    for (int i = 0; i < modules.length; i++) {
      batch.update(
        'modules',
        {'sort_order': i},
        where: 'id = ?',
        whereArgs: [modules[i].id],
      );
    }
    await batch.commit(noResult: true);
  }
}
