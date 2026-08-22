import 'dart:convert';
import '../database/database_helper.dart';
import 'sync_service.dart';

/// Exports App's data to finance.json format (EXT-compatible).
/// PRIMARY SOURCE: sync_records (canonical DataRecord storage).
/// This ensures round-trip fidelity: EXT → App → EXT preserves all fields.
class SyncExporter {
  SyncExporter._();
  static final SyncExporter instance = SyncExporter._();

  /// Export all App data to finance.json format.
  /// Reads from sync_records to preserve original EXT field structure.
  Future<Map<String, dynamic>> exportToJson() async {
    final db = await DatabaseHelper.instance.database;
    final deviceId = await SyncService.instance.getDeviceId();
    final now = DateTime.now().toUtc().toIso8601String();

    // Export ALL sync_records as DataRecords (including soft-deleted for propagation)
    final syncRows = await db.query('sync_records');
    final records = syncRows.map<Map<String, dynamic>>((row) {
      Map<String, dynamic> values = {};
      try {
        values = jsonDecode(row['values_json'] as String? ?? '{}') as Map<String, dynamic>;
      } catch (_) {}

      List<dynamic> tags = [];
      try {
        if (row['tags_json'] != null) tags = jsonDecode(row['tags_json'] as String) as List<dynamic>;
      } catch (_) {}

      List<dynamic> images = [];
      try {
        if (row['images_json'] != null) images = jsonDecode(row['images_json'] as String) as List<dynamic>;
      } catch (_) {}

      return {
        'id': row['id'],
        'moduleId': row['module_id'],
        'linkedModuleId': row['linked_module_id'],
        'categoryId': row['category_id'],
        'values': values,
        'tags': tags,
        'images': images,
        'isDeleted': (row['is_deleted'] as int? ?? 0) == 1,
        'deletedAt': row['deleted_at'],
        'createdAt': row['created_at'],
        'updatedAt': row['updated_at'],
      };
    }).toList();

    // Export accounts
    final accounts = await _exportAccounts(db);

    // Export categories (grouped under modules)
    final categories = await _exportCategories(db);

    return {
      'version': '1.0.0',
      'lastModified': now,
      'deviceId': deviceId,
      'modules': await _buildModulesWithCategories(categories, records),
      'accounts': accounts,
      'records': records,
    };
  }

  /// Export accounts
  Future<List<Map<String, dynamic>>> _exportAccounts(dynamic db) async {
    final rows = await db.query('accounts', where: 'is_active = 1');
    return rows.map<Map<String, dynamic>>((row) => {
      'id': row['id'],
      'name': row['name'] ?? '',
      'icon': row['icon'] ?? 'wallet',
      'color': row['color'] ?? '#2196F3',
      'initialBalance': (row['initial_balance'] as num?)?.toDouble() ?? 0,
      'currentBalance': (row['current_balance'] as num?)?.toDouble() ?? 0,
      'includeInTotal': (row['include_in_total'] as int? ?? 1) == 1,
      'isActive': true,
      'sortOrder': row['sort_order'] ?? 0,
      'createdAt': row['created_at'],
      'updatedAt': row['updated_at'],
    }).toList();
  }

  /// Export categories
  Future<List<Map<String, dynamic>>> _exportCategories(dynamic db) async {
    final rows = await db.query('categories', where: 'is_active = 1');
    return rows.map<Map<String, dynamic>>((row) => {
      'id': row['id'],
      'moduleId': 'mod_chitieu',
      'name': row['name'] ?? '',
      'icon': row['icon'] ?? 'other',
      'color': row['color'] ?? '#607D8B',
      'parentId': row['parent_id'],
      'sortOrder': row['sort_order'] ?? 0,
      'isActive': true,
      'createdAt': row['created_at'],
      'updatedAt': row['updated_at'],
    }).toList();
  }

  /// Build modules array with categories nested.
  /// Dynamically collects module IDs from app_data + records to support user-created modules.
  Future<List<Map<String, dynamic>>> _buildModulesWithCategories(
    List<Map<String, dynamic>> categories,
    List<Map<String, dynamic>> records,
  ) async {
    // Group categories by moduleId
    final Map<String, List<Map<String, dynamic>>> grouped = {};
    for (final cat in categories) {
      final modId = cat['moduleId'] as String? ?? 'mod_chitieu';
      grouped.putIfAbsent(modId, () => []).add(cat);
    }

    // Collect all known module IDs dynamically
    final Set<String> moduleIds = {};

    // Source 1: app_data modules (synced module definitions from EXT)
    try {
      final db = await DatabaseHelper.instance.database;
      final appDataRow = await db.query('app_data', where: "key = 'modules'");
      if (appDataRow.isNotEmpty) {
        final value = appDataRow.first['value'] as String?;
        if (value != null) {
          final List<dynamic> modules = jsonDecode(value) as List<dynamic>;
          for (final m in modules) {
            if (m is Map<String, dynamic> && m['id'] != null) {
              moduleIds.add(m['id'] as String);
            }
          }
        }
      }
    } catch (_) {}

    // Source 2: modules table
    try {
      final db = await DatabaseHelper.instance.database;
      final moduleRows = await db.query('modules');
      for (final row in moduleRows) {
        if (row['id'] != null) moduleIds.add(row['id'] as String);
      }
    } catch (_) {}

    // Source 3: from records moduleId (catch-all for orphaned records)
    for (final rec in records) {
      final modId = rec['moduleId'] as String?;
      if (modId != null && modId.isNotEmpty) moduleIds.add(modId);
    }

    // Source 4: core defaults (always include to avoid data loss)
    moduleIds.addAll(['mod_chitieu', 'mod_shopee', 'mod_vang', 'mod_nhatro', 'mod_creditcard', 'mod_ruou', 'mod_ruou_products', 'mod_ruou_customers', 'mod_ruou_inventory']);

    // Build minimal module entries with categories
    return moduleIds.map((id) => <String, dynamic>{
      'id': id,
      'categories': grouped[id] ?? <Map<String, dynamic>>[],
    }).toList();
  }
}
