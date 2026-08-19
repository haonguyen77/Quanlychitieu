import 'dart:convert';
import 'package:uuid/uuid.dart';
import '../../../database/database_helper.dart';
import '../models/wine_stock_in.dart';
import '../models/wine_sales_order.dart';
import '../models/wine_product.dart';

class WineStockRepository {
  final _uuid = const Uuid();

  // ============ STOCK IN ============

  Future<List<WineStockIn>> getStockIns({int? limit}) async {
    final db = await DatabaseHelper.instance.database;
    final limitClause = limit != null ? 'LIMIT $limit' : '';
    final result = await db.rawQuery('''
      SELECT * FROM wine_stock_in ORDER BY date DESC $limitClause
    ''');
    return result.map((m) => WineStockIn.fromMap(m)).toList();
  }

  Future<WineStockIn?> getStockInById(String id) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query('wine_stock_in', where: 'id = ?', whereArgs: [id]);
    if (result.isEmpty) return null;
    final stockIn = WineStockIn.fromMap(result.first);
    final items = await getStockInItems(id);
    return stockIn.copyWith(items: items);
  }

  Future<List<WineStockInItem>> getStockInItems(String stockInId) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.rawQuery('''
      SELECT si.*, p.name as product_name, vo.name as variant_name
      FROM wine_stock_in_items si
      LEFT JOIN wine_product_variants pv ON si.product_variant_id = pv.id
      LEFT JOIN wine_products p ON pv.product_id = p.id
      LEFT JOIN wine_variant_options vo ON pv.variant_option_id = vo.id
      WHERE si.stock_in_id = ?
      ORDER BY si.created_at ASC
    ''', [stockInId]);
    return result.map((m) => WineStockInItem.fromMap(m)).toList();
  }

  Future<WineStockIn> createStockIn(WineStockIn stockIn, List<WineStockInItem> items) async {
    final db = await DatabaseHelper.instance.database;
    final id = stockIn.id.isEmpty ? _uuid.v4() : stockIn.id;
    final now = DateTime.now();

    final newStockIn = stockIn.copyWith(id: id);
    await db.insert('wine_stock_in', {
      ...newStockIn.toMap(),
      'created_at': now.toIso8601String(),
      'updated_at': now.toIso8601String(),
    });

    final savedItems = <WineStockInItem>[];
    for (final item in items) {
      final itemId = _uuid.v4();
      final itemMap = {
        'id': itemId,
        'stock_in_id': id,
        'product_variant_id': item.productVariantId,
        'quantity': item.quantity,
        'remaining_quantity': item.quantity, // FIFO: starts full
        'note': item.note,
        'created_at': now.toIso8601String(),
      };
      await db.insert('wine_stock_in_items', itemMap);
      savedItems.add(WineStockInItem.fromMap(itemMap));
    }

    return newStockIn.copyWith(items: savedItems);
  }

  // ============ SALES ORDERS ============

  Future<List<WineSalesOrder>> getSalesOrders({int? limit}) async {
    final db = await DatabaseHelper.instance.database;
    final limitClause = limit != null ? 'LIMIT $limit' : '';
    final result = await db.rawQuery('''
      SELECT * FROM wine_sales_orders ORDER BY date DESC $limitClause
    ''');
    return result.map((m) => WineSalesOrder.fromMap(m)).toList();
  }

  Future<WineSalesOrder?> getSalesOrderById(String id) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query('wine_sales_orders', where: 'id = ?', whereArgs: [id]);
    if (result.isEmpty) return null;
    final order = WineSalesOrder.fromMap(result.first);
    final items = await getSalesOrderItems(id);
    return order.copyWith(items: items);
  }

  Future<List<WineSalesOrderItem>> getSalesOrderItems(String orderId) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.rawQuery('''
      SELECT soi.*, p.name as product_name, vo.name as variant_name
      FROM wine_sales_order_items soi
      LEFT JOIN wine_product_variants pv ON soi.product_variant_id = pv.id
      LEFT JOIN wine_products p ON pv.product_id = p.id
      LEFT JOIN wine_variant_options vo ON pv.variant_option_id = vo.id
      WHERE soi.sales_order_id = ?
    ''', [orderId]);
    return result.map((m) => WineSalesOrderItem.fromMap(m)).toList();
  }

  /// Creates a sales order and deducts stock using FIFO per variant.
  Future<WineSalesOrder> createSalesOrder(
      WineSalesOrder order, List<WineSalesOrderItem> items) async {
    final db = await DatabaseHelper.instance.database;
    final orderId = order.id.isEmpty ? _uuid.v4() : order.id;
    final now = DateTime.now();

    // Calculate total
    double itemsTotal = 0;
    for (final item in items) {
      itemsTotal += item.quantity * item.price;
    }
    final totalAmount = itemsTotal + order.shippingFee;

    final newOrder = order.copyWith(id: orderId, totalAmount: totalAmount);
    await db.insert('wine_sales_orders', {
      ...newOrder.toMap(),
      'created_at': now.toIso8601String(),
      'updated_at': now.toIso8601String(),
    });

    // Insert items and deduct stock FIFO
    for (final item in items) {
      final itemId = _uuid.v4();
      await db.insert('wine_sales_order_items', {
        ...item.copyWith(id: itemId, salesOrderId: orderId).toMap(),
      });

      // FIFO deduction for this variant
      await _deductStockFIFO(db, itemId, item.productVariantId, item.quantity, now);
    }

    // Write to sync_records for EXT sync
    await _upsertWineOrderSyncRecord(db, orderId, newOrder, items, now.toIso8601String());

    return newOrder;
  }

  /// FIFO stock deduction: deducts from oldest batches first
  Future<void> _deductStockFIFO(dynamic db, String salesOrderItemId,
      String productVariantId, int quantity, DateTime now) async {
    int remaining = quantity;

    // Get batches with remaining stock, ordered by date (FIFO)
    final batches = await db.rawQuery('''
      SELECT si_items.*
      FROM wine_stock_in_items si_items
      JOIN wine_stock_in si ON si_items.stock_in_id = si.id
      WHERE si_items.product_variant_id = ? AND si_items.remaining_quantity > 0
      ORDER BY si.date ASC, si_items.created_at ASC
    ''', [productVariantId]);

    for (final batch in batches) {
      if (remaining <= 0) break;

      final batchId = batch['id'] as String;
      final batchRemaining = batch['remaining_quantity'] as int;
      final deduct = remaining > batchRemaining ? batchRemaining : remaining;

      // Record deduction
      await db.insert('wine_stock_deductions', {
        'id': _uuid.v4(),
        'sales_order_item_id': salesOrderItemId,
        'stock_in_item_id': batchId,
        'quantity': deduct,
        'created_at': now.toIso8601String(),
      });

      // Update remaining quantity on batch
      await db.rawUpdate('''
        UPDATE wine_stock_in_items 
        SET remaining_quantity = remaining_quantity - ?
        WHERE id = ?
      ''', [deduct, batchId]);

      remaining -= deduct;
    }
  }

  /// Delete a sales order and restore stock (reverse FIFO deductions)
  Future<void> deleteSalesOrder(String orderId) async {
    final db = await DatabaseHelper.instance.database;

    // Get items for this order
    final items = await db.query('wine_sales_order_items', where: 'sales_order_id = ?', whereArgs: [orderId]);

    for (final item in items) {
      final itemId = item['id'] as String;

      // Reverse deductions: restore remaining_quantity in stock_in_items
      final deductions = await db.query('wine_stock_deductions', where: 'sales_order_item_id = ?', whereArgs: [itemId]);
      for (final ded in deductions) {
        final stockInItemId = ded['stock_in_item_id'] as String;
        final qty = ded['quantity'] as int;
        await db.rawUpdate('UPDATE wine_stock_in_items SET remaining_quantity = remaining_quantity + ? WHERE id = ?', [qty, stockInItemId]);
      }

      // Delete deductions
      await db.delete('wine_stock_deductions', where: 'sales_order_item_id = ?', whereArgs: [itemId]);
    }

    // Delete items
    await db.delete('wine_sales_order_items', where: 'sales_order_id = ?', whereArgs: [orderId]);

    // Delete order
    await db.delete('wine_sales_orders', where: 'id = ?', whereArgs: [orderId]);

    // Mark as deleted in sync_records
    final now = DateTime.now().toIso8601String();
    await db.update('sync_records', {
      'is_deleted': 1,
      'deleted_at': now,
      'updated_at': now,
    }, where: 'id = ?', whereArgs: [orderId]);
  }

  // ============ INVENTORY ============

  /// Get stock level for all variants of a product
  Future<List<WineProductVariant>> getProductStock(String productId) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.rawQuery('''
      SELECT pv.*, vo.name as variant_name, vt.name as variant_type_name,
        p.name as product_name,
        COALESCE(SUM(si.remaining_quantity), 0) as current_stock
      FROM wine_product_variants pv
      LEFT JOIN wine_variant_options vo ON pv.variant_option_id = vo.id
      LEFT JOIN wine_variant_types vt ON vo.variant_type_id = vt.id
      LEFT JOIN wine_products p ON pv.product_id = p.id
      LEFT JOIN wine_stock_in_items si ON si.product_variant_id = pv.id
      WHERE pv.product_id = ? AND pv.is_active = 1
      GROUP BY pv.id
      ORDER BY vo.sort_order ASC
    ''', [productId]);
    return result.map((m) => WineProductVariant.fromMap(m)).toList();
  }

  /// Get all inventory with stock levels
  Future<List<WineProductVariant>> getAllInventory() async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.rawQuery('''
      SELECT pv.*, vo.name as variant_name, vt.name as variant_type_name,
        p.name as product_name,
        COALESCE(SUM(si.remaining_quantity), 0) as current_stock
      FROM wine_product_variants pv
      LEFT JOIN wine_variant_options vo ON pv.variant_option_id = vo.id
      LEFT JOIN wine_variant_types vt ON vo.variant_type_id = vt.id
      LEFT JOIN wine_products p ON pv.product_id = p.id
      LEFT JOIN wine_stock_in_items si ON si.product_variant_id = pv.id
      WHERE pv.is_active = 1 AND p.is_active = 1
      GROUP BY pv.id
      ORDER BY p.name ASC, vo.sort_order ASC
    ''');
    return result.map((m) => WineProductVariant.fromMap(m)).toList();
  }

  /// Get low stock alerts
  Future<List<WineProductVariant>> getLowStockAlerts() async {
    final inventory = await getAllInventory();
    return inventory.where((v) => v.isLowStock).toList();
  }

  /// Get batch details for a variant (for inventory drilldown)
  Future<List<WineStockInItem>> getVariantBatches(String productVariantId) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.rawQuery('''
      SELECT si_items.*, p.name as product_name, vo.name as variant_name
      FROM wine_stock_in_items si_items
      JOIN wine_stock_in si ON si_items.stock_in_id = si.id
      LEFT JOIN wine_product_variants pv ON si_items.product_variant_id = pv.id
      LEFT JOIN wine_products p ON pv.product_id = p.id
      LEFT JOIN wine_variant_options vo ON pv.variant_option_id = vo.id
      WHERE si_items.product_variant_id = ? AND si_items.remaining_quantity > 0
      ORDER BY si.date ASC
    ''', [productVariantId]);
    return result.map((m) => WineStockInItem.fromMap(m)).toList();
  }

  // ============ REPORTS ============

  Future<Map<String, dynamic>> getMonthlyReport(int year, int month) async {
    final db = await DatabaseHelper.instance.database;
    final startDate = DateTime(year, month, 1).toIso8601String();
    final endDate = DateTime(year, month + 1, 1).toIso8601String();

    // Total stock in this month
    final stockInResult = await db.rawQuery('''
      SELECT COALESCE(SUM(si_items.quantity), 0) as total
      FROM wine_stock_in_items si_items
      JOIN wine_stock_in si ON si_items.stock_in_id = si.id
      WHERE si.date >= ? AND si.date < ?
    ''', [startDate, endDate]);

    // Total sold this month
    final soldResult = await db.rawQuery('''
      SELECT COALESCE(SUM(soi.quantity), 0) as total,
             COALESCE(SUM(soi.quantity * soi.price), 0) as revenue
      FROM wine_sales_order_items soi
      JOIN wine_sales_orders so ON soi.sales_order_id = so.id
      WHERE so.date >= ? AND so.date < ?
    ''', [startDate, endDate]);

    // Orders count
    final ordersResult = await db.rawQuery('''
      SELECT COUNT(*) as count FROM wine_sales_orders
      WHERE date >= ? AND date < ?
    ''', [startDate, endDate]);

    return {
      'total_stock_in': (stockInResult.first['total'] as num?)?.toInt() ?? 0,
      'total_sold': (soldResult.first['total'] as num?)?.toInt() ?? 0,
      'revenue': (soldResult.first['revenue'] as num?)?.toDouble() ?? 0,
      'orders_count': (ordersResult.first['count'] as num?)?.toInt() ?? 0,
    };
  }

  Future<List<Map<String, dynamic>>> getTopProductsByVariant({int? limit}) async {
    final db = await DatabaseHelper.instance.database;
    final limitClause = limit != null ? 'LIMIT $limit' : '';
    final result = await db.rawQuery('''
      SELECT p.name as product_name, vo.name as variant_name,
        COALESCE(SUM(soi.quantity), 0) as total_sold,
        COALESCE(SUM(soi.quantity * soi.price), 0) as total_revenue
      FROM wine_sales_order_items soi
      JOIN wine_product_variants pv ON soi.product_variant_id = pv.id
      JOIN wine_products p ON pv.product_id = p.id
      JOIN wine_variant_options vo ON pv.variant_option_id = vo.id
      GROUP BY pv.id
      ORDER BY total_sold DESC
      $limitClause
    ''');
    return result;
  }

  Future<List<Map<String, dynamic>>> getTopCustomers({int? limit}) async {
    final db = await DatabaseHelper.instance.database;
    final limitClause = limit != null ? 'LIMIT $limit' : '';
    final result = await db.rawQuery('''
      SELECT customer_name, customer_phone,
        COUNT(*) as order_count,
        COALESCE(SUM(total_amount), 0) as total_spent
      FROM wine_sales_orders
      WHERE customer_name IS NOT NULL AND customer_name != ''
      GROUP BY customer_name
      ORDER BY total_spent DESC
      $limitClause
    ''');
    return result;
  }

  /// Write wine order to sync_records for EXT sync (mod_ruou format)
  Future<void> _upsertWineOrderSyncRecord(
    dynamic db,
    String orderId,
    WineSalesOrder order,
    List<WineSalesOrderItem> items,
    String now,
  ) async {
    const prefix = 'mod_ruou_';
    final values = <String, dynamic>{
      '${prefix}order_date': order.date.toIso8601String().substring(0, 10),
      '${prefix}customer_name': order.customerName ?? '',
      '${prefix}customer_phone': order.customerPhone ?? '',
      '${prefix}customer_address': order.customerAddress ?? '',
      '${prefix}customer_district': order.customerDistrict ?? '',
      '${prefix}customer_city': order.customerCity ?? '',
      '${prefix}ship_fee': order.shippingFee,
      '${prefix}total_amount': order.totalAmount,
    };
    if (order.note1 != null) values['${prefix}note1'] = order.note1;
    if (order.note2 != null) values['${prefix}note2'] = order.note2;

    // Build product_lines for multi-product orders
    if (items.isNotEmpty) {
      final productLines = <Map<String, dynamic>>[];
      for (final item in items) {
        // Get product info
        final variantResult = await db.rawQuery('''
          SELECT pv.*, p.sku, p.name, vo.name as color_name
          FROM wine_product_variants pv
          JOIN wine_products p ON pv.product_id = p.id
          LEFT JOIN wine_variant_options vo ON pv.variant_option_id = vo.id
          WHERE pv.id = ?
        ''', [item.productVariantId]);

        String sku = '';
        String color = '';
        if (variantResult.isNotEmpty) {
          sku = variantResult.first['sku'] as String? ?? '';
          color = variantResult.first['color_name'] as String? ?? '';
        }

        productLines.add({
          'productSku': sku,
          'color': color,
          'quantity': item.quantity,
          'price': item.price,
          'glasses': item.hasGlass,
          'boxes': item.hasBox,
        });
      }
      values['${prefix}product_lines'] = jsonEncode(productLines);
    }

    final record = {
      'id': orderId,
      'module_id': 'mod_ruou',
      'category_id': null,
      'values_json': jsonEncode(values),
      'tags_json': null,
      'images_json': order.images != null ? jsonEncode(order.images!.split(',').where((s) => s.isNotEmpty).toList()) : null,
      'is_deleted': 0,
      'deleted_at': null,
      'created_at': now,
      'updated_at': now,
    };

    final existing = await db.query('sync_records', where: 'id = ?', whereArgs: [orderId]);
    if (existing.isEmpty) {
      await db.insert('sync_records', record);
    } else {
      await db.update('sync_records', record, where: 'id = ?', whereArgs: [orderId]);
    }
  }
}
