import 'dart:convert';
import 'package:uuid/uuid.dart';
import '../database/database_helper.dart';
import '../services/auto_sync.dart';

/// Repository for querying DataRecords from the new unified records table.
/// Records are stored EXACTLY like EXT's DataRecord structure.
/// UI queries use module_id OR linked_module_id to find records belonging to a module.
class RecordRepository {
  final _uuid = const Uuid();
  final _db = DatabaseHelper.instance;

  /// Get all records for a module (by module_id OR linked_module_id)
  Future<List<Map<String, dynamic>>> getByModule(
    String moduleId, {
    bool includeDeleted = false,
    String? startDate,
    String? endDate,
  }) async {
    if (startDate != null && endDate != null) {
      return _db.getRecordsByModuleAndDate(moduleId, startDate, endDate, includeDeleted: includeDeleted);
    }
    return _db.getRecordsByModule(moduleId, includeDeleted: includeDeleted);
  }

  /// Get a single record by ID
  Future<Map<String, dynamic>?> getById(String id) async {
    final db = await _db.database;
    final rows = await db.query('records', where: 'id = ?', whereArgs: [id]);
    if (rows.isEmpty) return null;
    return rows.first;
  }

  /// Create a new record (same structure as EXT's addRecord)
  Future<String> create({
    required String moduleId,
    required Map<String, dynamic> values,
    String? categoryId,
    String? linkedModuleId,
  }) async {
    final db = await _db.database;
    final id = _uuid.v4();
    final now = DateTime.now().toIso8601String();

    await db.insert('records', {
      'id': id,
      'module_id': moduleId,
      'linked_module_id': linkedModuleId,
      'category_id': categoryId,
      'values_json': jsonEncode(values),
      'tags_json': null,
      'images_json': null,
      'is_deleted': 0,
      'deleted_at': null,
      'created_at': now,
      'updated_at': now,
    });

    AutoSync.instance.notifyDataChanged();
    return id;
  }

  /// Update a record's values
  Future<void> update(String id, Map<String, dynamic> newValues, {String? categoryId, String? linkedModuleId}) async {
    final db = await _db.database;
    final now = DateTime.now().toIso8601String();

    // Merge with existing values
    final existing = await db.query('records', where: 'id = ?', whereArgs: [id]);
    if (existing.isEmpty) return;

    Map<String, dynamic> existingValues = {};
    try {
      existingValues = jsonDecode(existing.first['values_json'] as String? ?? '{}') as Map<String, dynamic>;
    } catch (_) {}

    final mergedValues = {...existingValues, ...newValues};

    final updates = <String, dynamic>{
      'values_json': jsonEncode(mergedValues),
      'updated_at': now,
    };
    if (categoryId != null) updates['category_id'] = categoryId;
    if (linkedModuleId != null) updates['linked_module_id'] = linkedModuleId;

    await db.update('records', updates, where: 'id = ?', whereArgs: [id]);
    AutoSync.instance.notifyDataChanged();
  }

  /// Soft delete a record
  Future<void> softDelete(String id) async {
    final db = await _db.database;
    final now = DateTime.now().toIso8601String();
    await db.update('records', {
      'is_deleted': 1,
      'deleted_at': now,
      'updated_at': now,
    }, where: 'id = ?', whereArgs: [id]);
    AutoSync.instance.notifyDataChanged();
  }

  /// Restore a deleted record
  Future<void> restore(String id) async {
    final db = await _db.database;
    final now = DateTime.now().toIso8601String();
    await db.update('records', {
      'is_deleted': 0,
      'deleted_at': null,
      'updated_at': now,
    }, where: 'id = ?', whereArgs: [id]);
    AutoSync.instance.notifyDataChanged();
  }

  /// Permanent delete
  Future<void> permanentDelete(String id) async {
    final db = await _db.database;
    await db.delete('records', where: 'id = ?', whereArgs: [id]);
    AutoSync.instance.notifyDataChanged();
  }

  /// Search records by keyword across all values
  Future<List<Map<String, dynamic>>> search({
    String? moduleId,
    String? keyword,
    String? startDate,
    String? endDate,
  }) async {
    final db = await _db.database;

    String where = 'is_deleted = 0';
    List<dynamic> whereArgs = [];

    if (moduleId != null) {
      where += ' AND (module_id = ? OR linked_module_id = ?)';
      whereArgs.add(moduleId);
      whereArgs.add(moduleId);
    }

    final results = await db.query('records', where: where, whereArgs: whereArgs, orderBy: 'updated_at DESC');

    // Filter by keyword and date in Dart (values are in JSON)
    return results.where((row) {
      // Date filter
      if (startDate != null || endDate != null) {
        final valuesStr = row['values_json'] as String? ?? '{}';
        try {
          final values = jsonDecode(valuesStr) as Map<String, dynamic>;
          String? dateVal;
          for (final key in values.keys) {
            if (key.endsWith('_date') || key.endsWith('_month') || key.endsWith('_order_date')) {
              final v = values[key];
              if (v != null && v.toString().isNotEmpty) { dateVal = v.toString(); break; }
            }
          }
          if (dateVal != null) {
            if (startDate != null && dateVal.compareTo(startDate) < 0) return false;
            if (endDate != null && dateVal.compareTo(endDate) > 0) return false;
          }
        } catch (_) {}
      }

      // Keyword filter
      if (keyword != null && keyword.isNotEmpty) {
        final q = keyword.toLowerCase();
        final valuesStr = (row['values_json'] as String? ?? '').toLowerCase();
        return valuesStr.contains(q);
      }

      return true;
    }).toList();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER: Extract display values from a record row
  // ═══════════════════════════════════════════════════════════════════════════

  /// Get the values map from a raw DB row
  static Map<String, dynamic> getValues(Map<String, dynamic> row) {
    try {
      return jsonDecode(row['values_json'] as String? ?? '{}') as Map<String, dynamic>;
    } catch (_) {
      return {};
    }
  }

  /// Get a specific value from a record by field suffix (e.g., 'title', 'amount', 'date')
  /// Searches all keys ending with _fieldName
  static dynamic getValue(Map<String, dynamic> row, String fieldName) {
    final values = getValues(row);
    for (final key in values.keys) {
      if (key.endsWith('_$fieldName')) return values[key];
    }
    return null;
  }

  /// Get title for display (searches _title, _order_name, _card_name, _product_name, _full_name, _customer_name, _room_name)
  static String getTitle(Map<String, dynamic> row) {
    final values = getValues(row);
    final titleKeys = ['_title', '_order_name', '_card_name', '_product_name', '_full_name', '_customer_name', '_room_name'];
    for (final suffix in titleKeys) {
      for (final key in values.keys) {
        if (key.endsWith(suffix)) {
          final v = values[key];
          if (v != null && v.toString().isNotEmpty) return v.toString();
        }
      }
    }
    return 'Không có tiêu đề';
  }

  /// Get amount for display
  static double getAmount(Map<String, dynamic> row) {
    final values = getValues(row);
    for (final key in values.keys) {
      if (key.endsWith('_amount') || key.endsWith('_total_amount') || key.endsWith('_total')) {
        final v = values[key];
        if (v is num) return v.toDouble();
        if (v is String) return double.tryParse(v) ?? 0;
      }
    }
    return 0;
  }

  /// Get date for display
  static String? getDate(Map<String, dynamic> row) {
    final values = getValues(row);
    for (final key in values.keys) {
      if (key.endsWith('_date') || key.endsWith('_month') || key.endsWith('_order_date')) {
        final v = values[key];
        if (v != null && v.toString().isNotEmpty) return v.toString();
      }
    }
    return null;
  }

  /// Get type (0=expense, 1=income)
  static int getType(Map<String, dynamic> row) {
    final values = getValues(row);
    for (final key in values.keys) {
      if (key.endsWith('_type')) {
        final v = values[key];
        if (v == '1' || v == 1) return 1;
        if (v == 'sell') return 1;
        return 0;
      }
    }
    return 0;
  }
}
