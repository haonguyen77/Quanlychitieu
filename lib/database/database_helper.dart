import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

/// Database that mirrors EXT's finance.json structure EXACTLY.
/// 
/// EXT structure:
///   finance.json = { modules[], accounts[], records[], settings, ... }
///   
/// App DB mirrors this:
///   records table = DataRecord[] (ALL modules in 1 table, values stored as JSON)
///   accounts table = Account[]
///   app_data table = stores the full finance.json metadata (settings, modules, dashboard, etc.)
///
/// NO transformation, NO mapping — data is stored as-is from EXT.
class DatabaseHelper {
  DatabaseHelper._();
  static final DatabaseHelper instance = DatabaseHelper._();

  static const _dbName = 'qlct_v2.db';
  static const _dbVersion = 1;

  Database? _database;

  Future<Database> get database async {
    _database ??= await _initDB();
    return _database!;
  }

  Future<Database> _initDB() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, _dbName);

    return await openDatabase(
      path,
      version: _dbVersion,
      onCreate: _createDB,
    );
  }

  Future<void> _createDB(Database db, int version) async {
    // ═══════════════════════════════════════════════════════════════
    // RECORDS — mirrors DataRecord from EXT exactly
    // One row = one DataRecord. ALL modules stored in same table.
    // ═══════════════════════════════════════════════════════════════
    await db.execute('''
      CREATE TABLE records (
        id TEXT PRIMARY KEY,
        module_id TEXT NOT NULL,
        linked_module_id TEXT,
        category_id TEXT,
        values_json TEXT NOT NULL DEFAULT '{}',
        tags_json TEXT,
        images_json TEXT,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');
    await db.execute('CREATE INDEX idx_records_module ON records (module_id)');
    await db.execute('CREATE INDEX idx_records_linked ON records (linked_module_id)');
    await db.execute('CREATE INDEX idx_records_deleted ON records (is_deleted)');
    await db.execute('CREATE INDEX idx_records_updated ON records (updated_at)');

    // ═══════════════════════════════════════════════════════════════
    // ACCOUNTS — mirrors Account from EXT exactly
    // ═══════════════════════════════════════════════════════════════
    await db.execute('''
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT DEFAULT 'wallet',
        color TEXT DEFAULT '#2196F3',
        initial_balance REAL DEFAULT 0,
        current_balance REAL DEFAULT 0,
        include_in_total INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');

    // ═══════════════════════════════════════════════════════════════
    // APP_DATA — stores everything else from finance.json as JSON blobs
    // Key-value store for: settings, modules, dashboard, reports, 
    // menu, metadata, recurringTransactions, budgets, activityLog
    // ═══════════════════════════════════════════════════════════════
    await db.execute('''
      CREATE TABLE app_data (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      )
    ''');

    // ═══════════════════════════════════════════════════════════════
    // SYNC_META — sync state tracking
    // ═══════════════════════════════════════════════════════════════
    await db.execute('''
      CREATE TABLE sync_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    ''');

    debugPrint('[DB] Created new database v$_dbVersion');

    // ═══════════════════════════════════════════════════════════════
    // LEGACY COMPAT TABLES — empty tables so old code doesn't crash
    // These will be removed once all providers are migrated
    // ═══════════════════════════════════════════════════════════════
    await db.execute('CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, type INTEGER DEFAULT 0, amount REAL DEFAULT 0, title TEXT NOT NULL DEFAULT "", note TEXT, category_id TEXT, account_id TEXT, module_id TEXT, linked_module_id TEXT, date TEXT NOT NULL DEFAULT "", tags TEXT, images TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, sync_status TEXT, device_id TEXT, created_at TEXT NOT NULL DEFAULT "", updated_at TEXT NOT NULL DEFAULT "", beneficiary TEXT, quantity INTEGER DEFAULT 1, warranty_months INTEGER, warranty_date TEXT, event TEXT, store TEXT)');
    await db.execute('CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT "", icon TEXT DEFAULT "other", color TEXT DEFAULT "#607D8B", parent_id TEXT, type INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, sync_status TEXT, device_id TEXT, created_at TEXT NOT NULL DEFAULT "", updated_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS modules (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT "", icon TEXT DEFAULT "other", color TEXT DEFAULT "#607D8B", sort_order INTEGER DEFAULT 0, is_default INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT NOT NULL DEFAULT "", updated_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS module_fields (id TEXT PRIMARY KEY, module_id TEXT, field_name TEXT, field_label TEXT, field_type TEXT DEFAULT "text", sort_order INTEGER DEFAULT 0, is_required INTEGER DEFAULT 0, default_value TEXT, options TEXT, created_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS transaction_field_values (id TEXT PRIMARY KEY, transaction_id TEXT, field_id TEXT, value TEXT)');
    await db.execute('CREATE TABLE IF NOT EXISTS budgets (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT "", amount REAL DEFAULT 0, category_id TEXT, module_id TEXT, period TEXT DEFAULT "monthly", start_date TEXT, is_active INTEGER DEFAULT 1, created_at TEXT NOT NULL DEFAULT "", updated_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS beneficiaries (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT "", is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT "", updated_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS credit_cards (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT "", bank_name TEXT, last4 TEXT, credit_limit REAL DEFAULT 0, statement_day INTEGER DEFAULT 20, payment_due_days INTEGER DEFAULT 10, alert_days INTEGER DEFAULT 3, note TEXT, is_active INTEGER DEFAULT 1, sync_status TEXT, device_id TEXT, created_at TEXT NOT NULL DEFAULT "", updated_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS credit_card_transactions (id TEXT PRIMARY KEY, card_id TEXT, amount REAL DEFAULT 0, title TEXT, note TEXT, date TEXT, type TEXT DEFAULT "expense", installment_months INTEGER, installment_current INTEGER, installment_monthly REAL, is_paid INTEGER DEFAULT 0, sync_status TEXT, device_id TEXT, created_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS transfers (id TEXT PRIMARY KEY, from_account_id TEXT, to_account_id TEXT, amount REAL DEFAULT 0, note TEXT, date TEXT, created_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS activity_log (id TEXT PRIMARY KEY, action TEXT, entity_type TEXT, entity_id TEXT, old_data TEXT, new_data TEXT, created_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS recurring_transactions (id TEXT PRIMARY KEY, type INTEGER DEFAULT 0, amount REAL DEFAULT 0, title TEXT, note TEXT, category_id TEXT, account_id TEXT, module_id TEXT, frequency TEXT DEFAULT "monthly", next_date TEXT, is_auto INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT NOT NULL DEFAULT "", updated_at TEXT NOT NULL DEFAULT "")');
    // Wine tables
    await db.execute('CREATE TABLE IF NOT EXISTS wine_products (id TEXT PRIMARY KEY, sku TEXT, name TEXT NOT NULL DEFAULT "", short_name TEXT, volume_ml INTEGER, wine_type TEXT, bottle_type TEXT, note TEXT, is_active INTEGER DEFAULT 1, sync_status TEXT, device_id TEXT, created_at TEXT NOT NULL DEFAULT "", updated_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS wine_variant_types (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT "", sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS wine_variant_options (id TEXT PRIMARY KEY, variant_type_id TEXT, name TEXT NOT NULL DEFAULT "", sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS wine_product_variants (id TEXT PRIMARY KEY, product_id TEXT, variant_option_id TEXT, is_active INTEGER DEFAULT 1, created_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS wine_customers (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT "", phone TEXT, address TEXT, district TEXT, city TEXT, total_orders INTEGER DEFAULT 0, last_order_date TEXT, note TEXT, is_active INTEGER DEFAULT 1, sync_status TEXT, device_id TEXT, created_at TEXT NOT NULL DEFAULT "", updated_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS wine_sales_orders (id TEXT PRIMARY KEY, date TEXT NOT NULL DEFAULT "", customer_id TEXT, customer_name TEXT, customer_phone TEXT, customer_address TEXT, customer_district TEXT, customer_city TEXT, shipping_fee REAL DEFAULT 0, total_amount REAL DEFAULT 0, note1 TEXT, note2 TEXT, images TEXT, sync_status TEXT, device_id TEXT, created_at TEXT NOT NULL DEFAULT "", updated_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS wine_sales_order_items (id TEXT PRIMARY KEY, sales_order_id TEXT, product_variant_id TEXT, quantity INTEGER DEFAULT 0, price REAL DEFAULT 0, has_glass INTEGER DEFAULT 0, has_box INTEGER DEFAULT 0, note TEXT, sync_status TEXT, device_id TEXT)');
    await db.execute('CREATE TABLE IF NOT EXISTS wine_stock_in (id TEXT PRIMARY KEY, date TEXT, note TEXT, created_at TEXT NOT NULL DEFAULT "", updated_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS wine_stock_in_items (id TEXT PRIMARY KEY, stock_in_id TEXT, product_variant_id TEXT, quantity INTEGER DEFAULT 0, remaining_quantity INTEGER DEFAULT 0, note TEXT, created_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS wine_stock_deductions (id TEXT PRIMARY KEY, sales_order_item_id TEXT, stock_in_item_id TEXT, quantity INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS wine_product_fields (id TEXT PRIMARY KEY, field_name TEXT NOT NULL DEFAULT "", field_label TEXT NOT NULL DEFAULT "", field_type TEXT DEFAULT "text", sort_order INTEGER DEFAULT 0, is_required INTEGER DEFAULT 0, options TEXT, created_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS wine_product_field_values (id TEXT PRIMARY KEY, product_id TEXT NOT NULL DEFAULT "", field_id TEXT NOT NULL DEFAULT "", value TEXT)');
    await db.execute('CREATE TABLE IF NOT EXISTS gold_price_history (id TEXT PRIMARY KEY, gold_type TEXT NOT NULL DEFAULT "", price REAL NOT NULL DEFAULT 0, date TEXT NOT NULL DEFAULT "", created_at TEXT NOT NULL DEFAULT "")');
    // Rental tables
    await db.execute('CREATE TABLE IF NOT EXISTS rental_rooms (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT "", rent_amount REAL DEFAULT 0, note TEXT, is_active INTEGER DEFAULT 1, created_at TEXT NOT NULL DEFAULT "", updated_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS rental_tenants (id TEXT PRIMARY KEY, room_id TEXT, name TEXT NOT NULL DEFAULT "", phone TEXT, id_number TEXT, move_in_date TEXT, move_out_date TEXT, deposit REAL DEFAULT 0, note TEXT, is_active INTEGER DEFAULT 1, created_at TEXT NOT NULL DEFAULT "", updated_at TEXT NOT NULL DEFAULT "")');
    await db.execute('CREATE TABLE IF NOT EXISTS rental_monthly_bills (id TEXT PRIMARY KEY, room_id TEXT, tenant_id TEXT, year INTEGER, month INTEGER, rent_amount REAL DEFAULT 0, electricity REAL DEFAULT 0, water REAL DEFAULT 0, internet REAL DEFAULT 0, other REAL DEFAULT 0, total_amount REAL DEFAULT 0, payment_status TEXT DEFAULT "unpaid", paid_date TEXT, note TEXT, created_at TEXT NOT NULL DEFAULT "", updated_at TEXT NOT NULL DEFAULT "")');
    // Sync records (old format for compat)
    await db.execute('CREATE TABLE IF NOT EXISTS sync_records (id TEXT PRIMARY KEY, module_id TEXT NOT NULL DEFAULT "", linked_module_id TEXT, category_id TEXT, values_json TEXT NOT NULL DEFAULT "{}", tags_json TEXT, images_json TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, created_at TEXT NOT NULL DEFAULT "", updated_at TEXT NOT NULL DEFAULT "")');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RECORDS CRUD — direct mirror of DataRecord
  // ═══════════════════════════════════════════════════════════════════════════

  /// Upsert a single DataRecord (from finance.json)
  Future<void> upsertRecord(Database db, Map<String, dynamic> record) async {
    final id = record['id'] as String;
    final row = {
      'id': id,
      'module_id': record['moduleId'] as String? ?? '',
      'linked_module_id': record['linkedModuleId'] as String?,
      'category_id': record['categoryId'] as String?,
      'values_json': jsonEncode(record['values'] ?? {}),
      'tags_json': record['tags'] != null ? jsonEncode(record['tags']) : null,
      'images_json': record['images'] != null ? jsonEncode(record['images']) : null,
      'is_deleted': (record['isDeleted'] == true) ? 1 : 0,
      'deleted_at': record['deletedAt'] as String?,
      'created_at': record['createdAt'] as String? ?? DateTime.now().toIso8601String(),
      'updated_at': record['updatedAt'] as String? ?? DateTime.now().toIso8601String(),
    };

    await db.insert('records', row, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  /// Get all records for a module (by module_id OR linked_module_id)
  Future<List<Map<String, dynamic>>> getRecordsByModule(String moduleId, {bool includeDeleted = false}) async {
    final db = await database;
    final deletedFilter = includeDeleted ? '' : ' AND is_deleted = 0';
    return db.rawQuery(
      'SELECT * FROM records WHERE (module_id = ? OR linked_module_id = ?)$deletedFilter ORDER BY updated_at DESC',
      [moduleId, moduleId],
    );
  }

  /// Get records filtered by date (extracts date from values_json)
  Future<List<Map<String, dynamic>>> getRecordsByModuleAndDate(
    String moduleId,
    String startDate,
    String endDate, {
    bool includeDeleted = false,
  }) async {
    final db = await database;
    // Get all records for module, filter by date in Dart (since date is inside JSON)
    final deletedFilter = includeDeleted ? '' : ' AND is_deleted = 0';
    final results = await db.rawQuery(
      'SELECT * FROM records WHERE (module_id = ? OR linked_module_id = ?)$deletedFilter ORDER BY updated_at DESC',
      [moduleId, moduleId],
    );
    
    // Filter by date in values_json
    return results.where((row) {
      final valuesStr = row['values_json'] as String? ?? '{}';
      try {
        final values = jsonDecode(valuesStr) as Map<String, dynamic>;
        // Find date field (ends with _date, _order_date, or _month)
        String? dateVal;
        for (final key in values.keys) {
          if (key.endsWith('_date') || key.endsWith('_month') || key.endsWith('_order_date')) {
            final v = values[key];
            if (v != null && v.toString().isNotEmpty) {
              dateVal = v.toString();
              break;
            }
          }
        }
        if (dateVal == null) return true; // no date = include
        return dateVal.compareTo(startDate) >= 0 && dateVal.compareTo(endDate) <= 0;
      } catch (_) {
        return true;
      }
    }).toList();
  }

  /// Export all records as DataRecord list (for finance.json export)
  Future<List<Map<String, dynamic>>> exportAllRecords() async {
    final db = await database;
    final rows = await db.query('records');
    return rows.map((row) {
      Map<String, dynamic> values = {};
      try { values = jsonDecode(row['values_json'] as String? ?? '{}') as Map<String, dynamic>; } catch (_) {}
      List<dynamic> tags = [];
      try { if (row['tags_json'] != null) tags = jsonDecode(row['tags_json'] as String) as List<dynamic>; } catch (_) {}
      List<dynamic> images = [];
      try { if (row['images_json'] != null) images = jsonDecode(row['images_json'] as String) as List<dynamic>; } catch (_) {}

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
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCOUNTS CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> upsertAccount(Database db, Map<String, dynamic> acc) async {
    final row = {
      'id': acc['id'] as String,
      'name': acc['name'] ?? '',
      'icon': acc['icon'] ?? 'wallet',
      'color': acc['color'] ?? '#2196F3',
      'initial_balance': (acc['initialBalance'] as num?)?.toDouble() ?? 0,
      'current_balance': (acc['currentBalance'] as num?)?.toDouble() ?? 0,
      'include_in_total': (acc['includeInTotal'] == true) ? 1 : 0,
      'is_active': (acc['isActive'] != false) ? 1 : 0,
      'sort_order': acc['sortOrder'] ?? 0,
      'created_at': acc['createdAt'] ?? DateTime.now().toIso8601String(),
      'updated_at': acc['updatedAt'] ?? DateTime.now().toIso8601String(),
    };
    await db.insert('accounts', row, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<List<Map<String, dynamic>>> exportAllAccounts() async {
    final db = await database;
    final rows = await db.query('accounts', where: 'is_active = 1');
    return rows.map((row) => {
      'id': row['id'],
      'name': row['name'],
      'icon': row['icon'],
      'color': row['color'],
      'initialBalance': (row['initial_balance'] as num?)?.toDouble() ?? 0,
      'currentBalance': (row['current_balance'] as num?)?.toDouble() ?? 0,
      'includeInTotal': (row['include_in_total'] as int? ?? 1) == 1,
      'isActive': true,
      'sortOrder': row['sort_order'] ?? 0,
      'createdAt': row['created_at'],
      'updatedAt': row['updated_at'],
    }).toList();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // APP_DATA — key-value store for JSON blobs
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> setAppData(String key, dynamic value) async {
    final db = await database;
    await db.insert('app_data', {
      'key': key,
      'value_json': jsonEncode(value),
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<dynamic> getAppData(String key) async {
    final db = await database;
    final rows = await db.query('app_data', where: 'key = ?', whereArgs: [key]);
    if (rows.isEmpty) return null;
    try {
      return jsonDecode(rows.first['value_json'] as String);
    } catch (_) {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC_META — simple key-value for sync state
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> setSyncMeta(String key, String value) async {
    final db = await database;
    await db.insert('sync_meta', {'key': key, 'value': value},
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<String?> getSyncMeta(String key) async {
    final db = await database;
    final rows = await db.query('sync_meta', where: 'key = ?', whereArgs: [key]);
    if (rows.isEmpty) return null;
    return rows.first['value'] as String?;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMPORT finance.json — stores entire file into DB
  // ═══════════════════════════════════════════════════════════════════════════

  /// Import a complete finance.json into the database.
  /// Replaces ALL existing data.
  Future<void> importFinanceJson(Map<String, dynamic> data) async {
    final db = await database;

    await db.transaction((txn) async {
      // Clear existing data
      await txn.delete('records');
      await txn.delete('accounts');
      await txn.delete('app_data');

      // Import records
      final records = data['records'] as List<dynamic>? ?? [];
      for (final rec in records) {
        final record = rec as Map<String, dynamic>;
        final id = record['id'] as String? ?? '';
        if (id.isEmpty) continue;

        await txn.insert('records', {
          'id': id,
          'module_id': record['moduleId'] as String? ?? '',
          'linked_module_id': record['linkedModuleId'] as String?,
          'category_id': record['categoryId'] as String?,
          'values_json': jsonEncode(record['values'] ?? {}),
          'tags_json': record['tags'] != null ? jsonEncode(record['tags']) : null,
          'images_json': record['images'] != null ? jsonEncode(record['images']) : null,
          'is_deleted': (record['isDeleted'] == true) ? 1 : 0,
          'deleted_at': record['deletedAt'] as String?,
          'created_at': record['createdAt'] as String? ?? DateTime.now().toIso8601String(),
          'updated_at': record['updatedAt'] as String? ?? DateTime.now().toIso8601String(),
        }, conflictAlgorithm: ConflictAlgorithm.replace);
      }

      // Import accounts
      final accounts = data['accounts'] as List<dynamic>? ?? [];
      for (final acc in accounts) {
        final account = acc as Map<String, dynamic>;
        await txn.insert('accounts', {
          'id': account['id'] as String? ?? '',
          'name': account['name'] ?? '',
          'icon': account['icon'] ?? 'wallet',
          'color': account['color'] ?? '#2196F3',
          'initial_balance': (account['initialBalance'] as num?)?.toDouble() ?? 0,
          'current_balance': (account['currentBalance'] as num?)?.toDouble() ?? 0,
          'include_in_total': (account['includeInTotal'] == true) ? 1 : 0,
          'is_active': (account['isActive'] != false) ? 1 : 0,
          'sort_order': account['sortOrder'] ?? 0,
          'created_at': account['createdAt'] ?? DateTime.now().toIso8601String(),
          'updated_at': account['updatedAt'] ?? DateTime.now().toIso8601String(),
        }, conflictAlgorithm: ConflictAlgorithm.replace);
      }

      // Store everything else as app_data JSON blobs
      final keysToStore = ['settings', 'modules', 'dashboard', 'reports', 'menu',
        'metadata', 'recurringTransactions', 'budgets', 'activityLog', 'version', 'deviceId'];
      for (final key in keysToStore) {
        if (data.containsKey(key)) {
          await txn.insert('app_data', {
            'key': key,
            'value_json': jsonEncode(data[key]),
          }, conflictAlgorithm: ConflictAlgorithm.replace);
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // POPULATE LEGACY TABLES — so old screens still work
      // ═══════════════════════════════════════════════════════════════
      await _populateLegacyTables(txn, data);
    });

    final recordCount = (data['records'] as List?)?.length ?? 0;
    debugPrint('[DB] Imported finance.json: $recordCount records');
  }

  /// Populate legacy tables from finance.json so old screens work
  Future<void> _populateLegacyTables(dynamic txn, Map<String, dynamic> data) async {
    final now = DateTime.now().toIso8601String();

    // Clear legacy tables
    await txn.delete('modules');
    await txn.delete('categories');
    await txn.delete('transactions');
    await txn.delete('credit_cards');
    await txn.delete('wine_products');
    await txn.delete('wine_product_variants');
    await txn.delete('wine_customers');
    await txn.delete('wine_sales_orders');
    await txn.delete('wine_sales_order_items');

    // Ensure variant infrastructure
    await txn.insert('wine_variant_types', {'id': 'wvt_color', 'name': 'Màu sắc', 'sort_order': 0, 'is_active': 1, 'created_at': now}, conflictAlgorithm: ConflictAlgorithm.replace);
    await txn.insert('wine_variant_options', {'id': 'wvo_none', 'variant_type_id': 'wvt_color', 'name': 'Mặc định', 'sort_order': 0, 'is_active': 1, 'created_at': now}, conflictAlgorithm: ConflictAlgorithm.replace);

    // --- MODULES & CATEGORIES ---
    final modules = data['modules'] as List<dynamic>? ?? [];
    for (final mod in modules) {
      final m = mod as Map<String, dynamic>;
      await txn.insert('modules', {
        'id': m['id'] ?? '',
        'name': m['name'] ?? '',
        'icon': m['icon'] ?? 'other',
        'color': m['color'] ?? '#607D8B',
        'sort_order': m['sortOrder'] ?? 0,
        'is_default': (m['isDefault'] == true) ? 1 : 0,
        'is_active': (m['isActive'] != false) ? 1 : 0,
        'created_at': m['createdAt'] ?? now,
        'updated_at': m['updatedAt'] ?? now,
      }, conflictAlgorithm: ConflictAlgorithm.replace);

      // Categories within module
      final cats = m['categories'] as List<dynamic>? ?? [];
      for (final cat in cats) {
        final c = cat as Map<String, dynamic>;
        await txn.insert('categories', {
          'id': c['id'] ?? '',
          'name': c['name'] ?? '',
          'icon': c['icon'] ?? 'other',
          'color': c['color'] ?? '#607D8B',
          'parent_id': c['parentId'],
          'type': 0,
          'sort_order': c['sortOrder'] ?? 0,
          'is_active': (c['isActive'] != false) ? 1 : 0,
          'created_at': c['createdAt'] ?? now,
          'updated_at': c['updatedAt'] ?? now,
        }, conflictAlgorithm: ConflictAlgorithm.replace);
      }
    }

    // --- RECORDS → LEGACY TABLES ---
    final records = data['records'] as List<dynamic>? ?? [];

    // Debug: count records by moduleId/linkedModuleId before processing
    final moduleCounts = <String, int>{};
    for (final rec in records) {
      final r = rec as Map<String, dynamic>;
      final mid = r['moduleId'] as String? ?? 'NULL';
      final lid = r['linkedModuleId'] as String? ?? '';
      final key = lid.isNotEmpty ? '$mid→$lid' : mid;
      moduleCounts[key] = (moduleCounts[key] ?? 0) + 1;
    }
    debugPrint('[IMPORT-LEGACY] Input records by module: $moduleCounts');

    // Two-pass: first products/customers (so JOINs work), then orders/transactions
    final productRecords = records.where((r) {
      final mid = (r as Map<String, dynamic>)['moduleId'] as String? ?? '';
      final lid = (r as Map<String, dynamic>)['linkedModuleId'] as String? ?? '';
      final eff = lid.isNotEmpty ? lid : mid;
      return eff == 'mod_ruou_products' || eff == 'mod_ruou_customers';
    }).toList();
    final otherRecords = records.where((r) {
      final mid = (r as Map<String, dynamic>)['moduleId'] as String? ?? '';
      final lid = (r as Map<String, dynamic>)['linkedModuleId'] as String? ?? '';
      final eff = lid.isNotEmpty ? lid : mid;
      return eff != 'mod_ruou_products' && eff != 'mod_ruou_customers';
    }).toList();
    final sortedRecords = [...productRecords, ...otherRecords];

    for (final rec in sortedRecords) {
      final r = rec as Map<String, dynamic>;
      final moduleId = r['moduleId'] as String? ?? '';
      final linkedModuleId = r['linkedModuleId'] as String?;
      final effectiveModule = (linkedModuleId != null && linkedModuleId.isNotEmpty) ? linkedModuleId : moduleId;
      final values = r['values'] as Map<String, dynamic>? ?? {};
      final isDeleted = r['isDeleted'] == true;
      final id = r['id'] as String? ?? '';
      if (id.isEmpty) continue;

      // Safe timestamps — handle null AND empty string
      final createdAt = (r['createdAt'] != null && r['createdAt'].toString().isNotEmpty)
          ? r['createdAt'].toString() : now;
      final updatedAt = (r['updatedAt'] != null && r['updatedAt'].toString().isNotEmpty)
          ? r['updatedAt'].toString() : now;

      // Helper: find value by suffix
      String findStr(String suffix) {
        for (final key in values.keys) {
          if (key.endsWith('_$suffix')) {
            final v = values[key];
            if (v != null && v.toString().isNotEmpty) return v.toString();
          }
        }
        return '';
      }
      double findNum(String suffix) {
        for (final key in values.keys) {
          if (key.endsWith('_$suffix')) {
            final v = values[key];
            if (v is num) return v.toDouble();
            if (v is String) return double.tryParse(v) ?? 0;
          }
        }
        return 0;
      }

      try {
      switch (effectiveModule) {
        case 'mod_chitieu':
        case 'mod_shopee':
        case 'mod_vang':
        case 'mod_nhatro':
          // → transactions table (keep deleted with is_deleted flag for trash screen)
          String title = findStr('title');
          if (title.isEmpty) title = findStr('order_name');
          if (title.isEmpty) title = findStr('room_name');
          if (title.isEmpty) title = findStr('customer_name');
          if (title.isEmpty) title = effectiveModule;

          double amount = findNum('amount');
          if (amount == 0) amount = findNum('total_amount');
          if (amount == 0) amount = findNum('total');

          final typeStr = findStr('type');
          int type = 0;
          if (typeStr == '1' || typeStr == 'sell') type = 1;
          if (typeStr == '2') type = 2; // Credit card payment — not counted in expense totals

          String date = findStr('date');
          if (date.isEmpty) date = findStr('order_date');
          if (date.isEmpty) date = findStr('month');
          if (date.isEmpty) date = now.substring(0, 10);

          await txn.insert('transactions', {
            'id': id,
            'type': type,
            'amount': amount,
            'title': title,
            'note': findStr('note').isNotEmpty ? findStr('note') : null,
            'category_id': r['categoryId'],
            'account_id': findStr('account').isNotEmpty ? _mapAccount(findStr('account')) : null,
            'module_id': effectiveModule,
            'linked_module_id': linkedModuleId,
            'date': date,
            'tags': findStr('tags').isNotEmpty ? findStr('tags') : null,
            'is_deleted': isDeleted ? 1 : 0,
            'deleted_at': r['deletedAt'],
            'created_at': createdAt,
            'updated_at': updatedAt,
            'beneficiary': findStr('beneficiary').isNotEmpty ? findStr('beneficiary') : null,
            'quantity': findNum('quantity').toInt() > 0 ? findNum('quantity').toInt() : 1,
            'warranty_months': findNum('warranty_months').toInt() > 0 ? findNum('warranty_months').toInt() : null,
            'warranty_date': findStr('warranty_date').isNotEmpty ? findStr('warranty_date') : null,
          }, conflictAlgorithm: ConflictAlgorithm.replace);
          break;

        case 'mod_creditcard':
          // → credit_cards table (skip deleted)
          if (isDeleted) break;
          final cardName = findStr('card_name');
          if (cardName.isEmpty) break;
          await txn.insert('credit_cards', {
            'id': id,
            'name': cardName,
            'bank_name': findStr('bank_name').isNotEmpty ? findStr('bank_name') : null,
            'last4': findStr('last4').isNotEmpty ? findStr('last4') : null,
            'credit_limit': findNum('credit_limit'),
            'statement_day': findNum('statement_day').toInt() > 0 ? findNum('statement_day').toInt() : 20,
            'payment_due_days': findNum('payment_due_day').toInt() > 0 ? findNum('payment_due_day').toInt() : 10,
            'alert_days': 3,
            'note': findStr('note').isNotEmpty ? findStr('note') : null,
            'is_active': isDeleted ? 0 : 1,
            'created_at': createdAt,
            'updated_at': updatedAt,
          }, conflictAlgorithm: ConflictAlgorithm.replace);

          // Auto-create account for credit card
          final accId = 'acc_cc_$id';
          await txn.insert('accounts', {
            'id': accId,
            'name': '$cardName${findStr('last4').isNotEmpty ? ' (*${findStr('last4')})' : ''}',
            'icon': 'credit_card',
            'color': '#1A237E',
            'initial_balance': 0,
            'current_balance': 0,
            'include_in_total': 0,
            'is_active': isDeleted ? 0 : 1,
            'sort_order': 99,
            'created_at': createdAt,
            'updated_at': updatedAt,
          }, conflictAlgorithm: ConflictAlgorithm.replace);
          break;

        case 'mod_ruou':
          // → wine_sales_orders table (skip deleted)
          if (isDeleted) break;
          debugPrint('[IMPORT] Wine order: id=$id customer=${findStr('customer_name')} date=${findStr('order_date')}');
          await txn.insert('wine_sales_orders', {
            'id': id,
            'date': findStr('order_date').isNotEmpty ? findStr('order_date') : now.substring(0, 10),
            'customer_name': findStr('customer_name'),
            'customer_phone': findStr('customer_phone'),
            'customer_address': findStr('customer_address'),
            'customer_district': findStr('customer_district'),
            'customer_city': findStr('customer_city'),
            'shipping_fee': findNum('ship_fee'),
            'total_amount': findNum('total_amount'),
            'note1': findStr('note1').isNotEmpty ? findStr('note1') : null,
            'note2': findStr('note2').isNotEmpty ? findStr('note2') : null,
            'created_at': createdAt,
            'updated_at': updatedAt,
          }, conflictAlgorithm: ConflictAlgorithm.replace);
          // Parse product_lines and insert wine_sales_order_items
          try {
            final productLinesRaw = values['mod_ruou_product_lines'];
            List<dynamic> lines = [];
            if (productLinesRaw is String && productLinesRaw.isNotEmpty) {
              lines = jsonDecode(productLinesRaw) as List<dynamic>;
            } else if (productLinesRaw is List) {
              lines = productLinesRaw;
            }
            if (lines.isNotEmpty) {
              for (int i = 0; i < lines.length; i++) {
                final line = lines[i] as Map<String, dynamic>;
                final sku = line['productSku'] as String? ?? '';
                // Find variant by product SKU
                String variantId = 'pv_unknown_$i';
                if (sku.isNotEmpty) {
                  final products = await txn.rawQuery('SELECT id FROM wine_products WHERE sku = ?', [sku]);
                  if (products.isNotEmpty) {
                    variantId = 'pv_${products.first['id']}';
                  }
                }
                await txn.insert('wine_sales_order_items', {
                  'id': '${id}_item_$i',
                  'sales_order_id': id,
                  'product_variant_id': variantId,
                  'quantity': (line['quantity'] as num?)?.toInt() ?? 0,
                  'price': (line['price'] as num?)?.toDouble() ?? 0,
                  'has_glass': (line['glasses'] as num?)?.toInt() ?? 0,
                  'has_box': (line['boxes'] as num?)?.toInt() ?? 0,
                }, conflictAlgorithm: ConflictAlgorithm.replace);
              }
            } else {
              // Single product order (flat fields)
              final sku = findStr('product_sku');
              if (sku.isNotEmpty || findNum('quantity') > 0) {
                String variantId = 'pv_unknown';
                if (sku.isNotEmpty) {
                  final products = await txn.rawQuery('SELECT id FROM wine_products WHERE sku = ?', [sku]);
                  if (products.isNotEmpty) variantId = 'pv_${products.first['id']}';
                }
                await txn.insert('wine_sales_order_items', {
                  'id': '${id}_item_0',
                  'sales_order_id': id,
                  'product_variant_id': variantId,
                  'quantity': findNum('quantity').toInt(),
                  'price': findNum('price'),
                  'has_glass': findNum('glasses').toInt(),
                  'has_box': findNum('boxes').toInt(),
                }, conflictAlgorithm: ConflictAlgorithm.replace);
              }
            }
          } catch (e) {
            debugPrint('[IMPORT] Wine order items error for $id: $e');
          }
          break;

        case 'mod_ruou_products':
          // → wine_products table (skip deleted)
          if (isDeleted) break;
          final sku = findStr('sku');
          final name = findStr('product_name');
          await txn.insert('wine_products', {
            'id': id,
            'sku': sku.isNotEmpty ? sku : id.substring(0, 8),
            'name': name.isNotEmpty ? name : 'Sản phẩm',
            'short_name': findStr('short_name').isNotEmpty ? findStr('short_name') : null,
            'volume_ml': findNum('volume_ml').toInt() > 0 ? findNum('volume_ml').toInt() : null,
            'wine_type': findStr('wine_type').isNotEmpty ? findStr('wine_type') : null,
            'bottle_type': findStr('bottle_type').isNotEmpty ? findStr('bottle_type') : null,
            'note': findStr('note').isNotEmpty ? findStr('note') : null,
            'is_active': isDeleted ? 0 : 1,
            'created_at': createdAt,
            'updated_at': updatedAt,
          }, conflictAlgorithm: ConflictAlgorithm.replace);
          // Also create a default variant for this product (needed for order items)
          await txn.insert('wine_product_variants', {
            'id': 'pv_$id',
            'product_id': id,
            'variant_option_id': 'wvo_none',
            'is_active': 1,
            'created_at': createdAt,
          }, conflictAlgorithm: ConflictAlgorithm.replace);
          break;

        case 'mod_ruou_customers':
          // → wine_customers table (skip deleted)
          if (isDeleted) break;
          await txn.insert('wine_customers', {
            'id': id,
            'name': findStr('full_name').isNotEmpty ? findStr('full_name') : 'Khách hàng',
            'phone': findStr('phone').isNotEmpty ? findStr('phone') : null,
            'address': findStr('address').isNotEmpty ? findStr('address') : null,
            'district': findStr('district').isNotEmpty ? findStr('district') : null,
            'city': findStr('city').isNotEmpty ? findStr('city') : null,
            'total_orders': findNum('total_orders').toInt(),
            'last_order_date': findStr('last_order_date').isNotEmpty ? findStr('last_order_date') : null,
            'note': findStr('note').isNotEmpty ? findStr('note') : null,
            'is_active': isDeleted ? 0 : 1,
            'created_at': createdAt,
            'updated_at': updatedAt,
          }, conflictAlgorithm: ConflictAlgorithm.replace);
          break;

        default:
          // Generic handler for user-created/dynamic modules
          // Store in transactions table with best-effort field extraction
          String title = findStr('title');
          if (title.isEmpty) title = findStr('name');
          if (title.isEmpty) title = findStr('order_name');
          if (title.isEmpty) {
            // Try first non-empty string value as title
            for (final entry in values.entries) {
              if (entry.value is String && (entry.value as String).isNotEmpty && !entry.key.endsWith('_note') && !entry.key.endsWith('_date')) {
                title = entry.value as String;
                break;
              }
            }
          }
          if (title.isEmpty) title = effectiveModule;

          double amount = findNum('amount');
          if (amount == 0) amount = findNum('total_amount');
          if (amount == 0) amount = findNum('total');
          if (amount == 0) amount = findNum('price');

          final typeStr = findStr('type');
          int type = 0;
          if (typeStr == '1' || typeStr == 'sell') type = 1;

          String date = findStr('date');
          if (date.isEmpty) date = findStr('order_date');
          if (date.isEmpty) date = createdAt.substring(0, 10);

          await txn.insert('transactions', {
            'id': id,
            'type': type,
            'amount': amount,
            'title': title,
            'note': findStr('note').isNotEmpty ? findStr('note') : null,
            'category_id': r['categoryId'],
            'account_id': findStr('account').isNotEmpty ? _mapAccount(findStr('account')) : null,
            'module_id': effectiveModule,
            'linked_module_id': linkedModuleId,
            'date': date,
            'tags': findStr('tags').isNotEmpty ? findStr('tags') : null,
            'is_deleted': isDeleted ? 1 : 0,
            'deleted_at': r['deletedAt'],
            'created_at': createdAt,
            'updated_at': updatedAt,
          }, conflictAlgorithm: ConflictAlgorithm.replace);

          // Also ensure module exists in modules table
          await txn.insert('modules', {
            'id': effectiveModule,
            'name': effectiveModule.replaceFirst('mod_', '').replaceAll('_', ' '),
            'icon': 'other',
            'color': '#607D8B',
            'sort_order': 99,
            'is_default': 0,
            'is_active': 1,
            'created_at': createdAt,
            'updated_at': updatedAt,
          }, conflictAlgorithm: ConflictAlgorithm.ignore);
          break;
      }
      } catch (e) {
        debugPrint('[IMPORT-LEGACY] Error importing record $id (module=$effectiveModule): $e');
      }
    }

    // Count what was inserted
    final txnCount = await txn.rawQuery('SELECT COUNT(*) as c FROM transactions');
    final ccCount = await txn.rawQuery('SELECT COUNT(*) as c FROM credit_cards');
    final woCount = await txn.rawQuery('SELECT COUNT(*) as c FROM wine_sales_orders');
    final wpCount = await txn.rawQuery('SELECT COUNT(*) as c FROM wine_products');
    final wcCount = await txn.rawQuery('SELECT COUNT(*) as c FROM wine_customers');
    final catCount = await txn.rawQuery('SELECT COUNT(*) as c FROM categories');
    debugPrint('[IMPORT-LEGACY] transactions=${txnCount.first['c']} credit_cards=${ccCount.first['c']} wine_orders=${woCount.first['c']} wine_products=${wpCount.first['c']} wine_customers=${wcCount.first['c']} categories=${catCount.first['c']}');
  }

  /// Map account value from EXT format to app account ID
  String? _mapAccount(String value) {
    if (value.isEmpty) return null;
    if (value.startsWith('credit_card_')) return 'acc_cc_${value.replaceFirst('credit_card_', '')}';
    switch (value) {
      case 'cash': return 'acc_cash';
      case 'bank': return 'acc_bank';
      case 'momo': return 'acc_momo';
      case 'tpbank': return 'acc_tpbank';
      case 'vpbank': return 'acc_vpbank';
      case 'zalopay': return 'acc_zalopay';
      case 'credit_card': return 'acc_credit';
      default: return null;
    }
  }

  /// Export database back to finance.json format — exact mirror of EXT
  Future<Map<String, dynamic>> exportFinanceJson() async {
    final db = await database;

    // Export records
    final recordRows = await db.query('records');
    final records = recordRows.map((row) {
      Map<String, dynamic> values = {};
      try { values = jsonDecode(row['values_json'] as String? ?? '{}') as Map<String, dynamic>; } catch (_) {}
      List<dynamic> tags = [];
      try { if (row['tags_json'] != null) tags = jsonDecode(row['tags_json'] as String) as List<dynamic>; } catch (_) {}
      List<dynamic> images = [];
      try { if (row['images_json'] != null) images = jsonDecode(row['images_json'] as String) as List<dynamic>; } catch (_) {}

      final record = <String, dynamic>{
        'id': row['id'],
        'moduleId': row['module_id'],
        'categoryId': row['category_id'],
        'values': values,
        'tags': tags,
        'images': images,
        'isDeleted': (row['is_deleted'] as int? ?? 0) == 1,
        'deletedAt': row['deleted_at'],
        'createdAt': row['created_at'],
        'updatedAt': row['updated_at'],
      };
      // Only include linkedModuleId if it has a value (match EXT behavior)
      if (row['linked_module_id'] != null) {
        record['linkedModuleId'] = row['linked_module_id'];
      }
      return record;
    }).toList();

    // Export accounts
    final accountRows = await db.query('accounts');
    final accounts = accountRows.map((row) => {
      'id': row['id'],
      'name': row['name'],
      'icon': row['icon'],
      'color': row['color'],
      'initialBalance': (row['initial_balance'] as num?)?.toDouble() ?? 0,
      'currentBalance': (row['current_balance'] as num?)?.toDouble() ?? 0,
      'includeInTotal': (row['include_in_total'] as int? ?? 1) == 1,
      'isActive': (row['is_active'] as int? ?? 1) == 1,
      'sortOrder': row['sort_order'] ?? 0,
      'createdAt': row['created_at'],
      'updatedAt': row['updated_at'],
    }).toList();

    // Build finance.json
    final result = <String, dynamic>{
      'records': records,
      'accounts': accounts,
      'lastModified': DateTime.now().toUtc().toIso8601String(),
    };

    // Restore all app_data
    final appDataRows = await db.query('app_data');
    for (final row in appDataRows) {
      final key = row['key'] as String;
      try {
        result[key] = jsonDecode(row['value_json'] as String);
      } catch (_) {}
    }

    // Ensure version exists
    result.putIfAbsent('version', () => '1.0.0');

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> closeDB() async {
    final db = _database;
    if (db != null) {
      await db.close();
      _database = null;
    }
  }

  /// Delete the database file completely (for fresh start)
  Future<void> deleteDatabase() async {
    await closeDB();
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, _dbName);
    await databaseFactory.deleteDatabase(path);
    debugPrint('[DB] Database deleted');
  }

  /// Get database file path (for backup purposes)
  Future<String> getDatabasePath() async {
    final dbPath = await getDatabasesPath();
    return join(dbPath, _dbName);
  }
}
