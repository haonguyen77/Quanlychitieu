import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../database/database_helper.dart';

/// Converts finance.json (EXT format) ↔ App SQLite tables.
/// PRIMARY: saves DataRecords into sync_records (canonical, preserves all fields).
/// SECONDARY: populates domain tables (transactions, wine_*, credit_cards) for UI.
class SyncMapper {
  SyncMapper._();
  static final SyncMapper instance = SyncMapper._();
  final _uuid = const Uuid();

  /// Import data from finance.json using UPSERT by UUID into sync_records.
  /// Then populates domain tables for UI consumption.
  Future<SyncImportResult> importFromJson(Map<String, dynamic> data) async {
    final db = await DatabaseHelper.instance.database;
    final result = SyncImportResult();

    try {
      await db.transaction((txn) async {
        // Ensure variant infrastructure exists for wine
        await _ensureVariantInfrastructure(txn);

        // STEP 1: Master data - accounts, categories (UPSERT by ID)
        final accounts = data['accounts'] as List<dynamic>? ?? [];
        for (final acc in accounts) {
          await _upsertAccount(txn, acc as Map<String, dynamic>);
          result.accountsImported++;
        }

        final modules = data['modules'] as List<dynamic>? ?? [];
        for (final mod in modules) {
          final modMap = mod as Map<String, dynamic>;
          final categories = modMap['categories'] as List<dynamic>? ?? [];
          for (final cat in categories) {
            await _upsertCategory(txn, cat as Map<String, dynamic>);
            result.categoriesImported++;
          }
        }

        // STEP 2: Records → sync_records (canonical) + domain tables
        // Clear legacy migrated records (baseline timestamp) so EXT data takes over
        await txn.delete('sync_records', where: "updated_at = '2020-01-01T00:00:00.000Z'");

        final records = data['records'] as List<dynamic>? ?? [];
        for (final record in records) {
          final rec = record as Map<String, dynamic>;
          final moduleId = rec['moduleId'] as String? ?? '';
          if (moduleId.isEmpty) continue;

          // Determine effective module: linkedModuleId takes priority for routing
          final linkedModuleId = rec['linkedModuleId'] as String? ?? '';
          final effectiveModuleId = linkedModuleId.isNotEmpty ? linkedModuleId : moduleId;

          debugPrint('[SYNC-TRACE] Processing record id=${rec['id']} moduleId=$moduleId linkedModuleId=$linkedModuleId effectiveModuleId=$effectiveModuleId');

          // 2a. UPSERT into sync_records (canonical — preserves ALL fields)
          await _upsertSyncRecord(txn, rec);

          // 2b. Populate domain tables for UI
          try {
            switch (effectiveModuleId) {
              case 'mod_ruou_products':
                await _importWineProduct(txn, rec);
                result.productsImported++;
                break;
              case 'mod_ruou_customers':
                await _importWineCustomer(txn, rec);
                result.customersImported++;
                break;
              case 'mod_creditcard':
                await _importCreditCard(txn, rec);
                result.creditCardsImported++;
                break;
              case 'mod_ruou':
                await _importWineOrder(txn, rec);
                result.ordersImported++;
                break;
              case 'mod_ruou_inventory':
                // Skip domain populate for inventory (handled separately)
                break;
              default:
                // Chi tiêu, Shopee, Vàng, Nhà trọ → transactions table
                await _importTransaction(txn, rec, moduleId: effectiveModuleId);
                result.transactionsImported++;
                break;
            }
          } catch (e) {
            debugPrint('[SyncMapper] Domain populate error ($effectiveModuleId): $e');
            // Domain populate failure is non-fatal — sync_records already saved
          }
        }

        // Handle inventory snapshots (batch)
        final inventoryRecords = records
            .where((r) => (r as Map<String, dynamic>)['moduleId'] == 'mod_ruou_inventory')
            .map((r) => r as Map<String, dynamic>)
            .toList();
        if (inventoryRecords.isNotEmpty) {
          try {
            await _importInventorySnapshots(txn, inventoryRecords);
          } catch (e) {
            debugPrint('[SyncMapper] Inventory import error: $e');
          }
        }
      });

      result.success = true;
    } catch (e, stack) {
      debugPrint('SyncMapper import error: $e\n$stack');
      result.success = false;
      result.error = e.toString();
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC_RECORDS — CANONICAL UPSERT
  // ═══════════════════════════════════════════════════════════════════════════

  /// UPSERT DataRecord into sync_records. Preserves ALL fields from EXT.
  Future<void> _upsertSyncRecord(dynamic txn, Map<String, dynamic> rec) async {
    final id = rec['id'] as String? ?? _uuid.v4();
    final moduleId = rec['moduleId'] as String? ?? '';
    final linkedModuleId = rec['linkedModuleId'] as String?;
    final categoryId = rec['categoryId'] as String?;
    final values = rec['values'] as Map<String, dynamic>? ?? {};
    final tags = rec['tags'] as List<dynamic>?;
    final images = rec['images'] as List<dynamic>?;
    final isDeleted = rec['isDeleted'] as bool? ?? false;
    final deletedAt = rec['deletedAt'] as String?;
    final createdAt = rec['createdAt'] as String? ?? DateTime.now().toIso8601String();
    final updatedAt = rec['updatedAt'] as String? ?? DateTime.now().toIso8601String();

    final incoming = {
      'id': id,
      'module_id': moduleId,
      'linked_module_id': linkedModuleId,
      'category_id': categoryId,
      'values_json': jsonEncode(values),
      'tags_json': tags != null ? jsonEncode(tags) : null,
      'images_json': images != null ? jsonEncode(images) : null,
      'is_deleted': isDeleted ? 1 : 0,
      'deleted_at': deletedAt,
      'created_at': createdAt,
      'updated_at': updatedAt,
    };

    final existing = await txn.query('sync_records', where: 'id = ?', whereArgs: [id]);
    if (existing.isEmpty) {
      await txn.insert('sync_records', incoming);
    } else {
      final localUpdated = existing.first['updated_at'] as String? ?? '';
      if (updatedAt.compareTo(localUpdated) > 0) {
        await txn.update('sync_records', incoming, where: 'id = ?', whereArgs: [id]);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENSURE INFRASTRUCTURE
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> _ensureVariantInfrastructure(dynamic txn) async {
    final now = DateTime.now().toIso8601String();
    final existing = await txn.query('wine_variant_types', where: 'id = ?', whereArgs: ['wvt_color']);
    if (existing.isEmpty) {
      await txn.insert('wine_variant_types', {
        'id': 'wvt_color', 'name': 'Màu sắc', 'sort_order': 0, 'is_active': 1, 'created_at': now,
      });
    }
    final existingOpt = await txn.query('wine_variant_options', where: 'id = ?', whereArgs: ['wvo_none']);
    if (existingOpt.isEmpty) {
      await txn.insert('wine_variant_options', {
        'id': 'wvo_none', 'variant_type_id': 'wvt_color', 'name': 'Không màu', 'sort_order': 0, 'is_active': 1, 'created_at': now,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCOUNTS & CATEGORIES (UPSERT by UUID)
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> _upsertAccount(dynamic txn, Map<String, dynamic> acc) async {
    final id = acc['id'] as String? ?? _uuid.v4();
    final now = DateTime.now().toIso8601String();
    final incoming = {
      'id': id,
      'name': acc['name'] ?? '',
      'icon': acc['icon'] ?? 'wallet',
      'color': acc['color'] ?? '#2196F3',
      'initial_balance': (acc['initialBalance'] as num?)?.toDouble() ?? 0,
      'current_balance': (acc['currentBalance'] as num?)?.toDouble() ?? 0,
      'include_in_total': (acc['includeInTotal'] == true) ? 1 : 0,
      'is_active': (acc['isActive'] != false) ? 1 : 0,
      'sort_order': acc['sortOrder'] ?? 0,
      'sync_status': 'synced',
      'device_id': null,
      'created_at': acc['createdAt'] ?? now,
      'updated_at': acc['updatedAt'] ?? now,
    };

    final existing = await txn.query('accounts', where: 'id = ?', whereArgs: [id]);
    if (existing.isEmpty) {
      await txn.insert('accounts', incoming);
    } else {
      final localUpdated = existing.first['updated_at'] as String? ?? '';
      final remoteUpdated = acc['updatedAt'] as String? ?? '';
      if (remoteUpdated.compareTo(localUpdated) > 0) {
        await txn.update('accounts', incoming, where: 'id = ?', whereArgs: [id]);
      }
    }
  }

  Future<void> _upsertCategory(dynamic txn, Map<String, dynamic> cat) async {
    final id = cat['id'] as String? ?? _uuid.v4();
    final now = DateTime.now().toIso8601String();
    final incoming = {
      'id': id,
      'name': cat['name'] ?? '',
      'icon': cat['icon'] ?? 'other',
      'color': cat['color'] ?? '#2196F3',
      'parent_id': cat['parentId'],
      'type': 0,
      'sort_order': cat['sortOrder'] ?? 0,
      'is_active': (cat['isActive'] != false) ? 1 : 0,
      'sync_status': 'synced',
      'device_id': null,
      'created_at': cat['createdAt'] ?? now,
      'updated_at': cat['updatedAt'] ?? now,
    };

    final existing = await txn.query('categories', where: 'id = ?', whereArgs: [id]);
    if (existing.isEmpty) {
      await txn.insert('categories', incoming);
    } else {
      final localUpdated = existing.first['updated_at'] as String? ?? '';
      final remoteUpdated = cat['updatedAt'] as String? ?? '';
      if (remoteUpdated.compareTo(localUpdated) > 0) {
        await txn.update('categories', incoming, where: 'id = ?', whereArgs: [id]);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTIONS (domain table for UI — Chi tiêu, Shopee, Vàng, Nhà trọ)
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> _importTransaction(dynamic txn, Map<String, dynamic> rec, {required String moduleId}) async {
    final values = rec['values'] as Map<String, dynamic>? ?? {};
    final id = rec['id'] as String? ?? _uuid.v4();
    final now = DateTime.now().toIso8601String();

    // Determine value prefix: EXT linked modules use mod_chitieu_ prefix
    // Try module-specific prefix first, fall back to mod_chitieu_
    final originalModuleId = rec['moduleId'] as String? ?? moduleId;
    final prefix = '${moduleId}_';
    final fallbackPrefix = (moduleId != originalModuleId || moduleId != 'mod_chitieu')
        ? 'mod_chitieu_'
        : '';

    // Helper: get value trying module prefix first, then fallback
    String? vv(String fieldName) {
      final v = _v(values, '$prefix$fieldName');
      if (v != null) return v;
      if (fallbackPrefix.isNotEmpty) return _v(values, '$fallbackPrefix$fieldName');
      return null;
    }
    double dd(String fieldName) {
      final v = _d(values['$prefix$fieldName']);
      if (v != 0) return v;
      if (fallbackPrefix.isNotEmpty) return _d(values['$fallbackPrefix$fieldName']);
      return 0;
    }

    // Build title/amount based on module type for UI display
    String title;
    double amount;
    String date;
    int type;
    String? note;

    switch (moduleId) {
      case 'mod_vang':
        final goldType = vv('gold_type') ?? '';
        final txType = vv('type') ?? 'buy';
        final qty = vv('quantity') ?? '';
        title = '${txType == 'sell' ? 'Bán' : 'Mua'} $goldType ${qty}chỉ'.trim();
        amount = dd('total_amount') != 0
            ? dd('total_amount')
            : dd('price_per_unit') * dd('quantity');
        date = vv('date') ?? now.substring(0, 10);
        type = (txType == 'sell') ? 1 : 0;
        note = vv('note');
        // Fallback: if amount still 0 and title generic, try chi tieu fields directly
        if (amount == 0 && fallbackPrefix.isNotEmpty) {
          amount = _d(values['${fallbackPrefix}amount']);
        }
        if (title == 'Mua chỉ' || title == 'Bán chỉ') {
          final altTitle = vv('title');
          if (altTitle != null && altTitle.isNotEmpty) title = altTitle;
        }
        break;

      case 'mod_nhatro':
        final room = vv('room_name') ?? '';
        final tenant = vv('tenant_name') ?? '';
        title = '$room${tenant.isNotEmpty ? ' - $tenant' : ''}'.trim();
        amount = dd('total') != 0 ? dd('total') : dd('rent_amount');
        date = vv('month') ?? vv('date') ?? now.substring(0, 10);
        type = 0;
        note = vv('note');
        // Fallback: chi tieu fields
        if (title.isEmpty && fallbackPrefix.isNotEmpty) {
          title = _v(values, '${fallbackPrefix}title') ?? '';
        }
        if (amount == 0 && fallbackPrefix.isNotEmpty) {
          amount = _d(values['${fallbackPrefix}amount']);
        }
        break;

      case 'mod_shopee':
        title = vv('order_name') ?? '';
        amount = dd('amount');
        date = vv('date') ?? now.substring(0, 10);
        type = 0;
        note = vv('note');
        // Fallback: chi tieu fields
        if (title.isEmpty && fallbackPrefix.isNotEmpty) {
          title = _v(values, '${fallbackPrefix}title') ?? _v(values, '${fallbackPrefix}order_name') ?? 'Đơn Shopee';
        }
        if (amount == 0 && fallbackPrefix.isNotEmpty) {
          amount = _d(values['${fallbackPrefix}amount']);
        }
        break;

      default:
        title = vv('title') ?? 'Giao dịch';
        amount = dd('amount');
        date = vv('date') ?? now.substring(0, 10);
        final typeVal = vv('type');
        type = (typeVal == '1') ? 1 : 0;
        note = vv('note');
        break;
    }

    if (title.isEmpty) title = moduleId;

    // Try account from module prefix, fallback to chi tieu prefix
    final accountVal = vv('account');
    final accountId = accountVal != null ? _mapAccountValue(accountVal) : null;
    final categoryId = rec['categoryId'] as String?;
    final linkedModuleId = rec['linkedModuleId'] as String?;
    final isDeleted = rec['isDeleted'] as bool? ?? false;

    // Store EXACTLY like EXT: module_id = original moduleId, linked_module_id = linkedModuleId
    final originalModuleIdForStorage = rec['moduleId'] as String? ?? moduleId;

    final incoming = {
      'id': id,
      'type': type,
      'amount': amount,
      'title': title,
      'note': (note != null && note.isNotEmpty) ? note : null,
      'category_id': categoryId,
      'account_id': accountId,
      'module_id': originalModuleIdForStorage,
      'linked_module_id': linkedModuleId,
      'date': date,
      'tags': _listToString(rec['tags']),
      'images': _listToString(rec['images']),
      'is_deleted': isDeleted ? 1 : 0,
      'sync_status': 'synced',
      'device_id': null,
      'created_at': rec['createdAt'] ?? now,
      'updated_at': rec['updatedAt'] ?? now,
      'beneficiary': vv('beneficiary'),
      'quantity': _i(values['${prefix}quantity']) ?? (fallbackPrefix.isNotEmpty ? _i(values['${fallbackPrefix}quantity']) : null),
      'warranty_months': _i(values['${prefix}warranty_months']) ?? (fallbackPrefix.isNotEmpty ? _i(values['${fallbackPrefix}warranty_months']) : null),
      'warranty_date': vv('warranty_date'),
    };

    // Ensure FK references exist
    if (categoryId != null) {
      final catExists = await txn.query('categories', where: 'id = ?', whereArgs: [categoryId]);
      if (catExists.isEmpty) {
        await txn.insert('categories', {
          'id': categoryId, 'name': categoryId.replaceAll('cat_', '').replaceAll('_', ' '),
          'icon': 'other', 'color': '#607D8B', 'parent_id': null, 'type': 0,
          'sort_order': 99, 'is_active': 1, 'sync_status': 'synced', 'device_id': null,
          'created_at': now, 'updated_at': now,
        });
      }
    }
    if (accountId != null) {
      final accExists = await txn.query('accounts', where: 'id = ?', whereArgs: [accountId]);
      if (accExists.isEmpty) {
        await txn.insert('accounts', {
          'id': accountId, 'name': accountId.replaceAll('acc_', '').replaceAll('_', ' '),
          'icon': 'wallet', 'color': '#607D8B', 'initial_balance': 0, 'current_balance': 0,
          'include_in_total': 1, 'is_active': 1, 'sort_order': 99, 'sync_status': 'synced',
          'device_id': null, 'created_at': now, 'updated_at': now,
        });
      }
    }
    if (incoming['module_id'] != null) {
      final modId = incoming['module_id'] as String;
      final modExists = await txn.query('modules', where: 'id = ?', whereArgs: [modId]);
      if (modExists.isEmpty) {
        await txn.insert('modules', {
          'id': modId, 'name': modId.replaceAll('mod_', '').replaceAll('_', ' '),
          'icon': 'other', 'color': '#607D8B', 'sort_order': 99, 'is_default': 0,
          'is_active': 1, 'created_at': now, 'updated_at': now,
        });
      }
    }

    // UPSERT into transactions
    debugPrint('[SYNC-TRACE] _importTransaction id=$id module=$originalModuleIdForStorage linked=$linkedModuleId title=$title amount=$amount');
    final existing = await txn.query('transactions', where: 'id = ?', whereArgs: [id]);
    if (existing.isEmpty) {
      await txn.insert('transactions', incoming);
    } else {
      final localUpdated = existing.first['updated_at'] as String? ?? '';
      final remoteUpdated = rec['updatedAt'] as String? ?? '';
      // Always update if remote is newer or if linked_module_id changed
      if (remoteUpdated.compareTo(localUpdated) > 0 ||
          existing.first['linked_module_id'] != linkedModuleId) {
        await txn.update('transactions', incoming, where: 'id = ?', whereArgs: [id]);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREDIT CARDS (domain table)
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> _importCreditCard(dynamic txn, Map<String, dynamic> rec) async {
    final values = rec['values'] as Map<String, dynamic>? ?? {};
    final id = rec['id'] as String? ?? _uuid.v4();
    const prefix = 'mod_creditcard_';
    final now = DateTime.now().toIso8601String();

    final cardName = values['${prefix}card_name'] as String? ?? '';
    if (cardName.isEmpty) return;

    final isDeleted = rec['isDeleted'] as bool? ?? false;
    final incoming = {
      'id': id,
      'name': cardName,
      'bank_name': _v(values, '${prefix}bank_name'),
      'last4': _v(values, '${prefix}last4'),
      'credit_limit': _d(values['${prefix}credit_limit']),
      'statement_day': _i(values['${prefix}statement_day']) ?? 20,
      'payment_due_days': _i(values['${prefix}payment_due_day']) ?? 10,
      'alert_days': 3,
      'note': _v(values, '${prefix}note'),
      'is_active': isDeleted ? 0 : 1,
      'sync_status': 'synced',
      'device_id': null,
      'created_at': rec['createdAt'] ?? now,
      'updated_at': rec['updatedAt'] ?? now,
    };

    final existing = await txn.query('credit_cards', where: 'id = ?', whereArgs: [id]);
    if (existing.isEmpty) {
      await txn.insert('credit_cards', incoming);
    } else {
      final localUpdated = existing.first['updated_at'] as String? ?? '';
      final remoteUpdated = rec['updatedAt'] as String? ?? '';
      if (remoteUpdated.compareTo(localUpdated) > 0) {
        await txn.update('credit_cards', incoming, where: 'id = ?', whereArgs: [id]);
      }
    }

    // Create account entry for credit card
    final accId = 'acc_cc_$id';
    final existingAcc = await txn.query('accounts', where: 'id = ?', whereArgs: [accId]);
    if (existingAcc.isEmpty) {
      final last4 = _v(values, '${prefix}last4');
      await txn.insert('accounts', {
        'id': accId, 'name': '$cardName${last4 != null ? ' (*$last4)' : ''}',
        'icon': 'credit_card', 'color': '#1A237E', 'initial_balance': 0, 'current_balance': 0,
        'include_in_total': 0, 'is_active': isDeleted ? 0 : 1, 'sort_order': 99,
        'sync_status': 'synced', 'device_id': null, 'created_at': rec['createdAt'] ?? now, 'updated_at': rec['updatedAt'] ?? now,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WINE PRODUCTS (domain table)
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> _importWineProduct(dynamic txn, Map<String, dynamic> rec) async {
    final values = rec['values'] as Map<String, dynamic>? ?? {};
    final id = rec['id'] as String? ?? _uuid.v4();
    const prefix = 'mod_ruou_products_';
    final now = DateTime.now().toIso8601String();

    final name = values['${prefix}product_name'] as String? ?? '';
    final sku = values['${prefix}sku'] as String? ?? '';
    if (sku.isEmpty && name.isEmpty) return;

    if (sku.isNotEmpty) {
      final existing = await txn.query('wine_products', where: 'sku = ?', whereArgs: [sku]);
      if (existing.isNotEmpty) {
        await txn.update('wine_products', {
          'name': name, 'short_name': _v(values, '${prefix}short_name'),
          'volume_ml': _i(values['${prefix}volume_ml']),
          'wine_type': _v(values, '${prefix}wine_type'),
          'bottle_type': _v(values, '${prefix}bottle_type'),
          'note': _v(values, '${prefix}note'),
          'sync_status': 'synced', 'updated_at': rec['updatedAt'] ?? now,
        }, where: 'sku = ?', whereArgs: [sku]);
        return;
      }
    }

    await txn.insert('wine_products', {
      'id': id, 'sku': sku.isNotEmpty ? sku : _uuid.v4().substring(0, 8),
      'name': name.isNotEmpty ? name : sku,
      'short_name': _v(values, '${prefix}short_name'),
      'volume_ml': _i(values['${prefix}volume_ml']),
      'wine_type': _v(values, '${prefix}wine_type'),
      'bottle_type': _v(values, '${prefix}bottle_type'),
      'note': _v(values, '${prefix}note'),
      'is_active': 1, 'sync_status': 'synced', 'device_id': null,
      'created_at': rec['createdAt'] ?? now, 'updated_at': rec['updatedAt'] ?? now,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WINE CUSTOMERS (domain table)
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> _importWineCustomer(dynamic txn, Map<String, dynamic> rec) async {
    final values = rec['values'] as Map<String, dynamic>? ?? {};
    final id = rec['id'] as String? ?? _uuid.v4();
    const prefix = 'mod_ruou_customers_';
    final now = DateTime.now().toIso8601String();

    final name = values['${prefix}full_name'] as String? ?? '';
    if (name.isEmpty) return;

    final isDeleted = rec['isDeleted'] as bool? ?? false;
    final incoming = {
      'id': id, 'name': name,
      'phone': _v(values, '${prefix}phone'),
      'address': _v(values, '${prefix}address'),
      'district': _v(values, '${prefix}district'),
      'city': _v(values, '${prefix}city'),
      'note': _v(values, '${prefix}note'),
      'total_orders': _i(values['${prefix}total_orders']) ?? 0,
      'last_order_date': _v(values, '${prefix}last_order_date'),
      'is_active': isDeleted ? 0 : 1,
      'sync_status': 'synced', 'device_id': null,
      'created_at': rec['createdAt'] ?? now, 'updated_at': rec['updatedAt'] ?? now,
    };

    final existing = await txn.query('wine_customers', where: 'id = ?', whereArgs: [id]);
    if (existing.isEmpty) {
      await txn.insert('wine_customers', incoming);
    } else {
      final localUpdated = existing.first['updated_at'] as String? ?? '';
      if ((rec['updatedAt'] as String? ?? '').compareTo(localUpdated) > 0) {
        await txn.update('wine_customers', incoming, where: 'id = ?', whereArgs: [id]);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WINE ORDERS (domain table)
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> _importWineOrder(dynamic txn, Map<String, dynamic> rec) async {
    final values = rec['values'] as Map<String, dynamic>? ?? {};
    final orderId = rec['id'] as String? ?? _uuid.v4();
    const prefix = 'mod_ruou_';
    final now = DateTime.now().toIso8601String();

    final incoming = {
      'id': orderId,
      'date': values['${prefix}order_date'] as String? ?? now.substring(0, 10),
      'customer_id': null,
      'customer_name': values['${prefix}customer_name'] as String? ?? '',
      'customer_phone': values['${prefix}customer_phone'] as String? ?? '',
      'customer_address': values['${prefix}customer_address'] as String? ?? '',
      'customer_district': values['${prefix}customer_district'] as String? ?? '',
      'customer_city': values['${prefix}customer_city'] as String? ?? '',
      'shipping_fee': _d(values['${prefix}ship_fee']),
      'total_amount': _d(values['${prefix}total_amount']),
      'note1': _v(values, '${prefix}note1'),
      'note2': _v(values, '${prefix}note2'),
      'images': _listToString(rec['images']),
      'sync_status': 'synced', 'device_id': null,
      'created_at': rec['createdAt'] ?? now, 'updated_at': rec['updatedAt'] ?? now,
    };

    final existing = await txn.query('wine_sales_orders', where: 'id = ?', whereArgs: [orderId]);
    if (existing.isEmpty) {
      await txn.insert('wine_sales_orders', incoming);
      try {
        await _insertOrderItems(txn, orderId, values, prefix);
      } catch (e) {
        debugPrint('[SyncMapper] _insertOrderItems failed for order $orderId: $e');
        // Order is saved even if items fail
      }
    } else {
      final localUpdated = existing.first['updated_at'] as String? ?? '';
      if ((rec['updatedAt'] as String? ?? '').compareTo(localUpdated) > 0) {
        await txn.update('wine_sales_orders', incoming, where: 'id = ?', whereArgs: [orderId]);
        await txn.delete('wine_sales_order_items', where: 'sales_order_id = ?', whereArgs: [orderId]);
        try {
          await _insertOrderItems(txn, orderId, values, prefix);
        } catch (e) {
          debugPrint('[SyncMapper] _insertOrderItems failed for order $orderId (update): $e');
        }
      }
    }
  }

  Future<void> _insertOrderItems(dynamic txn, String orderId, Map<String, dynamic> values, String prefix) async {
    // Try product_lines (JSON array of multi-product orders)
    final productLinesRaw = values['${prefix}product_lines'];
    if (productLinesRaw != null) {
      try {
        List<dynamic> lines;
        if (productLinesRaw is String && productLinesRaw.isNotEmpty) {
          lines = json.decode(productLinesRaw) as List<dynamic>;
        } else if (productLinesRaw is List) {
          lines = productLinesRaw;
        } else {
          lines = [];
        }
        for (final line in lines) {
          try {
            await _insertOrderItem(txn, orderId, line as Map<String, dynamic>);
          } catch (e) {
            debugPrint('[SyncMapper] _insertOrderItem failed: $e');
          }
        }
        if (lines.isNotEmpty) return;
      } catch (e) {
        debugPrint('[SyncMapper] product_lines parse error: $e');
      }
    }
    // Fallback: flat fields
    final sku = values['${prefix}product_sku'] as String? ?? '';
    final color = values['${prefix}color'] as String? ?? '';
    final quantity = _toInt(values['${prefix}quantity']);
    final price = _toDouble(values['${prefix}price']);
    if (quantity <= 0 && price <= 0) return;

    final variantId = await _findOrCreateVariant(txn, sku, color);
    await txn.insert('wine_sales_order_items', {
      'id': _uuid.v4(), 'sales_order_id': orderId, 'product_variant_id': variantId,
      'quantity': quantity, 'price': price,
      'has_glass': _toInt(values['${prefix}glasses']) > 0 ? 1 : 0,
      'has_box': _toInt(values['${prefix}boxes']) > 0 ? 1 : 0,
      'note': null, 'sync_status': 'synced', 'device_id': null,
    });
  }

  Future<void> _insertOrderItem(dynamic txn, String orderId, Map<String, dynamic> line) async {
    final sku = line['productSku'] as String? ?? '';
    final color = line['color'] as String? ?? '';
    final quantity = int.tryParse(line['quantity']?.toString() ?? '0') ?? 0;
    final price = double.tryParse(line['price']?.toString() ?? '0') ?? 0;
    if (quantity <= 0 && price <= 0) return;

    final variantId = await _findOrCreateVariant(txn, sku, color);
    await txn.insert('wine_sales_order_items', {
      'id': _uuid.v4(), 'sales_order_id': orderId, 'product_variant_id': variantId,
      'quantity': quantity, 'price': price,
      'has_glass': (int.tryParse(line['glasses']?.toString() ?? '0') ?? 0) > 0 ? 1 : 0,
      'has_box': (int.tryParse(line['boxes']?.toString() ?? '0') ?? 0) > 0 ? 1 : 0,
      'note': null, 'sync_status': 'synced', 'device_id': null,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVENTORY SNAPSHOTS
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> _importInventorySnapshots(dynamic txn, List<Map<String, dynamic>> records) async {
    final now = DateTime.now().toIso8601String();

    // Check if already imported
    final existingStockIn = await txn.query('wine_stock_in',
        where: 'note = ?', whereArgs: ['Import từ EXT (tồn kho ban đầu)']);
    if (existingStockIn.isNotEmpty) return;

    final stockInId = _uuid.v4();
    await txn.insert('wine_stock_in', {
      'id': stockInId, 'date': now.substring(0, 10),
      'note': 'Import từ EXT (tồn kho ban đầu)',
      'created_at': now, 'updated_at': now,
    });

    for (final rec in records) {
      final values = rec['values'] as Map<String, dynamic>? ?? {};
      const prefix = 'mod_ruou_inventory_';
      final sku = _v(values, '${prefix}sku') ?? '';
      final color = _v(values, '${prefix}color') ?? '';
      final stock = _i(values['${prefix}stock']) ?? 0;
      if (sku.isEmpty || stock <= 0) continue;

      final variantId = await _findOrCreateVariant(txn, sku, color);
      await txn.insert('wine_stock_in_items', {
        'id': _uuid.v4(), 'stock_in_id': stockInId, 'product_variant_id': variantId,
        'quantity': stock, 'remaining_quantity': stock, 'note': null, 'created_at': now,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FIND OR CREATE VARIANT
  // ═══════════════════════════════════════════════════════════════════════════

  Future<String> _findOrCreateVariant(dynamic txn, String sku, String color) async {
    final now = DateTime.now().toIso8601String();

    String productId;
    if (sku.isNotEmpty) {
      final products = await txn.query('wine_products', where: 'sku = ?', whereArgs: [sku]);
      if (products.isNotEmpty) {
        productId = products.first['id'] as String;
      } else {
        productId = _uuid.v4();
        await txn.insert('wine_products', {
          'id': productId, 'sku': sku, 'name': sku,
          'is_active': 1, 'sync_status': 'synced', 'created_at': now, 'updated_at': now,
        });
      }
    } else {
      productId = _uuid.v4();
      await txn.insert('wine_products', {
        'id': productId, 'sku': 'UNKNOWN', 'name': 'SP không xác định',
        'is_active': 1, 'sync_status': 'synced', 'created_at': now, 'updated_at': now,
      });
    }

    String variantOptionId = 'wvo_none';
    if (color.isNotEmpty) {
      final options = await txn.query('wine_variant_options',
          where: 'UPPER(name) = ?', whereArgs: [color.toUpperCase()]);
      if (options.isNotEmpty) {
        variantOptionId = options.first['id'] as String;
      } else {
        variantOptionId = 'wvo_${color.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '_')}';
        final existing = await txn.query('wine_variant_options', where: 'id = ?', whereArgs: [variantOptionId]);
        if (existing.isEmpty) {
          await txn.insert('wine_variant_options', {
            'id': variantOptionId, 'variant_type_id': 'wvt_color',
            'name': color, 'sort_order': 99, 'is_active': 1, 'created_at': now,
          });
        }
      }
    }

    final variants = await txn.query('wine_product_variants',
        where: 'product_id = ? AND variant_option_id = ?',
        whereArgs: [productId, variantOptionId]);
    if (variants.isNotEmpty) return variants.first['id'] as String;

    final variantId = _uuid.v4();
    await txn.insert('wine_product_variants', {
      'id': variantId, 'product_id': productId, 'variant_option_id': variantOptionId,
      'min_stock': 0, 'is_active': 1, 'created_at': now,
    });
    return variantId;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  String? _v(Map<String, dynamic> values, String key) {
    final v = values[key];
    if (v == null) return null;
    final s = v.toString();
    return s.isEmpty ? null : s;
  }

  double _d(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  int? _i(dynamic v) {
    if (v == null) return null;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString());
  }

  double _toDouble(dynamic v) => _d(v);
  int _toInt(dynamic v) => _i(v) ?? 0;

  String? _listToString(dynamic list) {
    if (list == null) return null;
    if (list is List) {
      final joined = list.map((e) => e.toString()).where((s) => s.isNotEmpty).join(',');
      return joined.isEmpty ? null : joined;
    }
    return null;
  }

  String? _mapAccountValue(String value) {
    if (value.startsWith('credit_card_')) {
      return 'acc_cc_${value.replaceFirst('credit_card_', '')}';
    }
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
}

/// Result of a sync import operation
class SyncImportResult {
  bool success = false;
  String? error;
  int accountsImported = 0;
  int categoriesImported = 0;
  int transactionsImported = 0;
  int productsImported = 0;
  int customersImported = 0;
  int ordersImported = 0;
  int creditCardsImported = 0;

  int get totalRecords =>
      accountsImported + categoriesImported + transactionsImported +
      productsImported + customersImported + ordersImported + creditCardsImported;

  @override
  String toString() {
    if (!success) return 'Import failed: $error';
    return 'Đã import $totalRecords records\n'
        '• Tài khoản: $accountsImported\n'
        '• Danh mục: $categoriesImported\n'
        '• Giao dịch: $transactionsImported\n'
        '• Sản phẩm: $productsImported\n'
        '• Khách hàng: $customersImported\n'
        '• Đơn hàng: $ordersImported\n'
        '• Thẻ tín dụng: $creditCardsImported';
  }
}
