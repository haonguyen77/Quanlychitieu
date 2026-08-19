import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../../../database/database_helper.dart';
import '../../../services/auto_sync.dart';
import 'package:uuid/uuid.dart';

/// Wine Data Provider — reads/writes directly from `records` table.
/// 100% same data structure as EXT.
///
/// BUSINESS RULES:
/// - Customer stats (total_orders, last_order_date): recalculated from orders on App user action
/// - Inventory stock: deducted on create, returned on delete (same as EXT)
/// - Import from Drive: NO side effects — data taken as-is
///
/// IDEMPOTENT RULES:
/// - recalculateCustomerStats() can run N times → same result
/// - Import never triggers business logic
/// - Only explicit user actions (create/update/delete order) trigger derived data updates
class WineDataProvider extends ChangeNotifier {
  final _db = DatabaseHelper.instance;
  final _uuid = const Uuid();

  List<Map<String, dynamic>> _orders = [];
  List<Map<String, dynamic>> _products = [];
  List<Map<String, dynamic>> _customers = [];
  List<Map<String, dynamic>> _inventory = [];
  bool _isLoading = false;

  List<Map<String, dynamic>> get orders => _orders;
  List<Map<String, dynamic>> get products => _products;
  List<Map<String, dynamic>> get customers => _customers;
  List<Map<String, dynamic>> get inventory => _inventory;
  bool get isLoading => _isLoading;

  // ═══════════════════════════════════════════════════════════════════════════
  // LOAD — query records table by moduleId
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> loadOrders() async {
    final db = await _db.database;
    final rows = await db.rawQuery(
      "SELECT * FROM records WHERE module_id = 'mod_ruou' AND is_deleted = 0 ORDER BY updated_at DESC"
    );
    _orders = rows.map(_parseRow).toList();
    _orders.sort((a, b) => (b['order_date'] as String? ?? '').compareTo(a['order_date'] as String? ?? ''));
    notifyListeners();
  }

  Future<void> loadProducts() async {
    final db = await _db.database;
    final rows = await db.rawQuery(
      "SELECT * FROM records WHERE module_id = 'mod_ruou_products' AND is_deleted = 0 ORDER BY updated_at DESC"
    );
    _products = rows.map(_parseRow).toList();
    notifyListeners();
  }

  Future<void> loadCustomers() async {
    final db = await _db.database;
    final rows = await db.rawQuery(
      "SELECT * FROM records WHERE module_id = 'mod_ruou_customers' AND is_deleted = 0 ORDER BY updated_at DESC"
    );
    _customers = rows.map(_parseRow).toList();
    notifyListeners();
  }

  Future<void> loadInventory() async {
    final db = await _db.database;
    final rows = await db.rawQuery(
      "SELECT * FROM records WHERE module_id = 'mod_ruou_inventory' AND is_deleted = 0 ORDER BY updated_at DESC"
    );
    _inventory = rows.map(_parseRow).toList();
    notifyListeners();
  }

  Future<void> loadAll() async {
    _isLoading = true;
    notifyListeners();
    await Future.wait([loadOrders(), loadProducts(), loadCustomers(), loadInventory()]);
    _isLoading = false;
    notifyListeners();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD — raw record operations (NO side effects)
  // ═══════════════════════════════════════════════════════════════════════════

  /// Insert a record into records table. Returns the UUID.
  /// Does NOT trigger business logic. Caller must handle side effects explicitly.
  Future<String> _insertRecord(String moduleId, Map<String, dynamic> values) async {
    final db = await _db.database;
    final id = _uuid.v4();
    final now = DateTime.now().toUtc().toIso8601String();
    await db.insert('records', {
      'id': id,
      'module_id': moduleId,
      'linked_module_id': null,
      'category_id': null,
      'values_json': jsonEncode(values),
      'tags_json': null,
      'images_json': null,
      'is_deleted': 0,
      'deleted_at': null,
      'created_at': now,
      'updated_at': now,
    });
    return id;
  }

  /// Update a record's values (merge). Sets updated_at = now.
  Future<void> _updateRecord(String id, Map<String, dynamic> newValues) async {
    final db = await _db.database;
    final now = DateTime.now().toUtc().toIso8601String();
    final existing = await db.query('records', where: 'id = ?', whereArgs: [id]);
    if (existing.isEmpty) return;

    Map<String, dynamic> existingValues = {};
    try { existingValues = jsonDecode(existing.first['values_json'] as String? ?? '{}') as Map<String, dynamic>; } catch (_) {}
    final merged = {...existingValues, ...newValues};

    await db.update('records', {
      'values_json': jsonEncode(merged),
      'updated_at': now,
    }, where: 'id = ?', whereArgs: [id]);
  }

  /// Replace a record's values entirely. Sets updated_at = now.
  Future<void> _replaceRecord(String id, Map<String, dynamic> values) async {
    final db = await _db.database;
    final now = DateTime.now().toUtc().toIso8601String();
    await db.update('records', {
      'values_json': jsonEncode(values),
      'updated_at': now,
    }, where: 'id = ?', whereArgs: [id]);
  }

  /// Soft-delete a record. Sets is_deleted=1, updated_at=now.
  Future<void> _softDelete(String id) async {
    final db = await _db.database;
    final now = DateTime.now().toUtc().toIso8601String();
    await db.update('records', {
      'is_deleted': 1,
      'deleted_at': now,
      'updated_at': now,
    }, where: 'id = ?', whereArgs: [id]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDER BUSINESS LOGIC — user actions with side effects
  // ═══════════════════════════════════════════════════════════════════════════

  /// Create a new wine order.
  /// Side effects: deduct inventory, update customer stats.
  Future<String> createOrder(Map<String, dynamic> values) async {
    final id = await _insertRecord('mod_ruou', values);

    // Side effects
    await _deductInventoryForOrder(values);
    _ensureCustomer(values);

    AutoSync.instance.notifyDataChanged();
    await loadOrders();
    return id;
  }

  /// Update an existing wine order.
  /// Side effects: adjust inventory (return old qty, deduct new qty), update customer stats.
  Future<void> updateOrder(String id, Map<String, dynamic> newValues, {Map<String, dynamic>? oldValues}) async {
    // Return old inventory
    if (oldValues != null) {
      await _returnInventoryForOrder(oldValues);
    }

    await _replaceRecord(id, newValues);

    // Deduct new inventory
    await _deductInventoryForOrder(newValues);

    // Recalculate customer stats
    await _recalculateCustomerStats();

    AutoSync.instance.notifyDataChanged();
    await loadOrders();
  }

  /// Delete a wine order.
  /// Side effects: return inventory, recalculate customer stats.
  Future<void> deleteOrder(String id) async {
    // Get current values to return inventory
    final db = await _db.database;
    final rows = await db.query('records', where: 'id = ?', whereArgs: [id]);
    if (rows.isNotEmpty) {
      final values = _getValues(rows.first);
      await _returnInventoryForOrder(values);
    }

    await _softDelete(id);

    // Recalculate customer stats
    await _recalculateCustomerStats();

    AutoSync.instance.notifyDataChanged();
    await loadOrders();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCT/CUSTOMER/INVENTORY CRUD — simple, no cross-module side effects
  // ═══════════════════════════════════════════════════════════════════════════

  Future<String> addProduct(Map<String, dynamic> values) async {
    final id = await _insertRecord('mod_ruou_products', values);
    AutoSync.instance.notifyDataChanged();
    await loadProducts();
    return id;
  }

  Future<void> updateProduct(String id, Map<String, dynamic> values) async {
    await _replaceRecord(id, values);
    AutoSync.instance.notifyDataChanged();
    await loadProducts();
  }

  Future<void> deleteProduct(String id) async {
    await _softDelete(id);
    AutoSync.instance.notifyDataChanged();
    await loadProducts();
  }

  Future<String> addCustomer(Map<String, dynamic> values) async {
    final id = await _insertRecord('mod_ruou_customers', values);
    AutoSync.instance.notifyDataChanged();
    await loadCustomers();
    return id;
  }

  Future<void> updateCustomer(String id, Map<String, dynamic> values) async {
    await _replaceRecord(id, values);
    AutoSync.instance.notifyDataChanged();
    await loadCustomers();
  }

  Future<void> deleteCustomer(String id) async {
    await _softDelete(id);
    AutoSync.instance.notifyDataChanged();
    await loadCustomers();
  }

  Future<String> addInventory(Map<String, dynamic> values) async {
    final id = await _insertRecord('mod_ruou_inventory', values);
    AutoSync.instance.notifyDataChanged();
    await loadInventory();
    return id;
  }

  Future<void> updateInventory(String id, Map<String, dynamic> values) async {
    await _replaceRecord(id, values);
    AutoSync.instance.notifyDataChanged();
    await loadInventory();
  }

  Future<void> deleteInventory(String id) async {
    await _softDelete(id);
    AutoSync.instance.notifyDataChanged();
    await loadInventory();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DERIVED DATA — idempotent recalculation
  // ═══════════════════════════════════════════════════════════════════════════

  /// Recalculate ALL customer stats from orders.
  /// Idempotent: running N times gives same result.
  Future<void> _recalculateCustomerStats() async {
    final db = await _db.database;

    // Load all active orders
    final orderRows = await db.rawQuery(
      "SELECT values_json FROM records WHERE module_id = 'mod_ruou' AND is_deleted = 0"
    );

    // Count orders per customer (by phone or name)
    final customerOrders = <String, int>{}; // phone → count
    final customerLastDate = <String, String>{}; // phone → latest date

    for (final row in orderRows) {
      final values = _getValues(row);
      final phone = values['mod_ruou_customer_phone'] as String? ?? '';
      final name = values['mod_ruou_customer_name'] as String? ?? '';
      final date = values['mod_ruou_order_date'] as String? ?? '';
      final key = phone.isNotEmpty ? phone : name;
      if (key.isEmpty) continue;

      customerOrders[key] = (customerOrders[key] ?? 0) + 1;
      if (date.isNotEmpty) {
        final existing = customerLastDate[key] ?? '';
        if (date.compareTo(existing) > 0) customerLastDate[key] = date;
      }
    }

    // Update customer records
    final customerRows = await db.rawQuery(
      "SELECT id, values_json FROM records WHERE module_id = 'mod_ruou_customers' AND is_deleted = 0"
    );

    final now = DateTime.now().toUtc().toIso8601String();
    for (final row in customerRows) {
      final values = _getValues(row);
      final phone = values['mod_ruou_customers_phone'] as String? ?? '';
      final name = values['mod_ruou_customers_full_name'] as String? ?? '';
      final key = phone.isNotEmpty ? phone : name;

      final newTotal = customerOrders[key] ?? 0;
      final newLastDate = customerLastDate[key] ?? '';
      final oldTotal = values['mod_ruou_customers_total_orders'];
      final oldLastDate = values['mod_ruou_customers_last_order_date'] as String? ?? '';

      // Only update if changed
      if (oldTotal != newTotal || oldLastDate != newLastDate) {
        values['mod_ruou_customers_total_orders'] = newTotal;
        if (newLastDate.isNotEmpty) values['mod_ruou_customers_last_order_date'] = newLastDate;
        await db.update('records', {
          'values_json': jsonEncode(values),
          'updated_at': now,
        }, where: 'id = ?', whereArgs: [row['id']]);
      }
    }
  }

  /// Deduct inventory for an order's products.
  /// Reads product_lines (multi-product) or single product fields.
  Future<void> _deductInventoryForOrder(Map<String, dynamic> values) async {
    final lines = _getProductLines(values);
    for (final line in lines) {
      final sku = line['sku'] as String? ?? '';
      final qty = line['qty'] as int? ?? 0;
      if (sku.isEmpty || qty <= 0) continue;
      await _adjustInventory(sku, -qty);
    }
  }

  /// Return inventory for an order's products (on delete/update).
  Future<void> _returnInventoryForOrder(Map<String, dynamic> values) async {
    final lines = _getProductLines(values);
    for (final line in lines) {
      final sku = line['sku'] as String? ?? '';
      final qty = line['qty'] as int? ?? 0;
      if (sku.isEmpty || qty <= 0) continue;
      await _adjustInventory(sku, qty);
    }
  }

  /// Adjust inventory stock for a SKU by delta (negative = deduct, positive = return).
  Future<void> _adjustInventory(String sku, int delta) async {
    final db = await _db.database;
    final now = DateTime.now().toUtc().toIso8601String();

    // Find inventory record by SKU
    final rows = await db.rawQuery(
      "SELECT id, values_json FROM records WHERE module_id = 'mod_ruou_inventory' AND is_deleted = 0"
    );

    for (final row in rows) {
      final values = _getValues(row);
      final invSku = values['mod_ruou_inventory_sku'] as String? ?? '';
      if (invSku == sku || invSku == '$sku-') {
        final currentStock = (values['mod_ruou_inventory_stock'] is num)
            ? (values['mod_ruou_inventory_stock'] as num).toInt()
            : int.tryParse(values['mod_ruou_inventory_stock']?.toString() ?? '0') ?? 0;
        final newStock = (currentStock + delta).clamp(0, 999999);
        values['mod_ruou_inventory_stock'] = newStock;
        await db.update('records', {
          'values_json': jsonEncode(values),
          'updated_at': now,
        }, where: 'id = ?', whereArgs: [row['id']]);
        break;
      }
    }
  }

  /// Ensure customer record exists. If not, create one.
  /// If exists, stats will be recalculated separately.
  Future<void> _ensureCustomer(Map<String, dynamic> orderValues) async {
    final phone = orderValues['mod_ruou_customer_phone'] as String? ?? '';
    final name = orderValues['mod_ruou_customer_name'] as String? ?? '';
    if (name.isEmpty) return;

    final db = await _db.database;
    final rows = await db.rawQuery(
      "SELECT id, values_json FROM records WHERE module_id = 'mod_ruou_customers' AND is_deleted = 0"
    );

    // Check if customer exists (by phone first, then name)
    bool found = false;
    for (final row in rows) {
      final values = _getValues(row);
      final existingPhone = values['mod_ruou_customers_phone'] as String? ?? '';
      final existingName = values['mod_ruou_customers_full_name'] as String? ?? '';
      if ((phone.isNotEmpty && existingPhone == phone) || existingName == name) {
        found = true;
        break;
      }
    }

    if (!found) {
      // Create new customer
      await _insertRecord('mod_ruou_customers', {
        'mod_ruou_customers_full_name': name,
        'mod_ruou_customers_phone': phone,
        'mod_ruou_customers_address': orderValues['mod_ruou_customer_address'] ?? '',
        'mod_ruou_customers_district': orderValues['mod_ruou_customer_district'] ?? '',
        'mod_ruou_customers_city': orderValues['mod_ruou_customer_city'] ?? '',
        'mod_ruou_customers_total_orders': 1,
        'mod_ruou_customers_last_order_date': orderValues['mod_ruou_order_date'] ?? '',
        'mod_ruou_customers_note': '',
      });
    }

    // Recalculate stats (idempotent)
    await _recalculateCustomerStats();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /// Parse product lines from order values.
  /// Returns list of {sku, qty, price, name, color}.
  List<Map<String, dynamic>> _getProductLines(Map<String, dynamic> values) {
    final result = <Map<String, dynamic>>[];

    // Try product_lines JSON (multi-product)
    final plRaw = values['mod_ruou_product_lines'];
    if (plRaw != null && plRaw is String && plRaw.isNotEmpty) {
      try {
        final lines = jsonDecode(plRaw) as List<dynamic>;
        for (final l in lines) {
          final line = l as Map<String, dynamic>;
          result.add({
            'sku': line['productSku'] as String? ?? '',
            'name': line['productName'] as String? ?? '',
            'qty': int.tryParse(line['quantity']?.toString() ?? '0') ?? 0,
            'price': double.tryParse(line['price']?.toString() ?? '0') ?? 0,
            'color': line['color'] as String? ?? '',
          });
        }
        if (result.isNotEmpty) return result;
      } catch (_) {}
    }

    // Fallback: single product fields
    final sku = values['mod_ruou_product_sku'] as String? ?? '';
    final qty = (values['mod_ruou_quantity'] is num)
        ? (values['mod_ruou_quantity'] as num).toInt()
        : int.tryParse(values['mod_ruou_quantity']?.toString() ?? '0') ?? 0;
    if (sku.isNotEmpty || qty > 0) {
      result.add({
        'sku': sku,
        'name': values['mod_ruou_product_name'] as String? ?? '',
        'qty': qty,
        'price': (values['mod_ruou_price'] is num)
            ? (values['mod_ruou_price'] as num).toDouble()
            : double.tryParse(values['mod_ruou_price']?.toString() ?? '0') ?? 0,
        'color': values['mod_ruou_color'] as String? ?? '',
      });
    }

    return result;
  }

  /// Parse a DB row into a flat map with extracted values (stripped prefixes).
  Map<String, dynamic> _parseRow(Map<String, dynamic> row) {
    final result = <String, dynamic>{
      'id': row['id'],
      'module_id': row['module_id'],
      'created_at': row['created_at'],
      'updated_at': row['updated_at'],
    };
    final values = _getValues(row);
    for (final entry in values.entries) {
      final shortKey = _stripPrefix(entry.key);
      result[shortKey] = entry.value;
    }
    result['_raw_values'] = values;
    return result;
  }

  /// Get values map from a raw DB row.
  Map<String, dynamic> _getValues(Map<String, dynamic> row) {
    try {
      return jsonDecode(row['values_json'] as String? ?? '{}') as Map<String, dynamic>;
    } catch (_) {
      return {};
    }
  }

  /// Strip module prefix from key.
  String _stripPrefix(String key) {
    const prefixes = ['mod_ruou_inventory_', 'mod_ruou_products_', 'mod_ruou_customers_', 'mod_ruou_'];
    for (final p in prefixes) {
      if (key.startsWith(p)) return key.substring(p.length);
    }
    return key;
  }

  /// Get product short name by SKU.
  String getProductName(String? sku) {
    if (sku == null || sku.isEmpty) return '';
    for (final p in _products) {
      if (p['sku'] == sku) {
        return (p['short_name'] as String?) ?? (p['product_name'] as String?) ?? sku;
      }
    }
    return sku;
  }
}
