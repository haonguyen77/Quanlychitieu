import 'package:flutter/foundation.dart';
import '../models/wine_product.dart';
import '../models/wine_stock_in.dart';
import '../models/wine_sales_order.dart';
import '../repositories/wine_stock_repository.dart';
import '../../../services/auto_sync.dart';

class WineStockProvider extends ChangeNotifier {
  final WineStockRepository _repository = WineStockRepository();

  List<WineStockIn> _stockIns = [];
  List<WineSalesOrder> _salesOrders = [];
  List<WineProductVariant> _inventory = [];
  List<WineProductVariant> _lowStockAlerts = [];
  Map<String, dynamic> _monthlyReport = {};
  bool _isLoading = false;

  List<WineStockIn> get stockIns => _stockIns;
  List<WineSalesOrder> get salesOrders => _salesOrders;
  List<WineProductVariant> get inventory => _inventory;
  List<WineProductVariant> get lowStockAlerts => _lowStockAlerts;
  Map<String, dynamic> get monthlyReport => _monthlyReport;
  bool get isLoading => _isLoading;

  int get totalStock => _inventory.fold(0, (sum, v) => sum + (v.currentStock ?? 0));

  Future<void> loadStockIns({int? limit}) async {
    _stockIns = await _repository.getStockIns(limit: limit);
    notifyListeners();
  }

  Future<void> loadSalesOrders({int? limit}) async {
    try {
      final orders = await _repository.getSalesOrders(limit: limit);
      debugPrint('[WINE] getSalesOrders returned ${orders.length} orders');
      // Load items for each order to display in list
      final List<WineSalesOrder> ordersWithItems = [];
      for (final order in orders) {
        final items = await _repository.getSalesOrderItems(order.id);
        ordersWithItems.add(order.copyWith(items: items));
      }
      _salesOrders = ordersWithItems;
    } catch (e, stack) {
      debugPrint('[WINE] loadSalesOrders error: $e\n$stack');
      _salesOrders = [];
    }
    notifyListeners();
  }

  Future<void> loadInventory() async {
    _isLoading = true;
    notifyListeners();

    try {
      _inventory = await _repository.getAllInventory();
      _lowStockAlerts = await _repository.getLowStockAlerts();
    } catch (e) {
      debugPrint('[WINE] loadInventory error: $e');
      _inventory = [];
      _lowStockAlerts = [];
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadMonthlyReport(int year, int month) async {
    _monthlyReport = await _repository.getMonthlyReport(year, month);
    notifyListeners();
  }

  Future<WineStockIn?> getStockInById(String id) async {
    return _repository.getStockInById(id);
  }

  Future<WineSalesOrder?> getSalesOrderById(String id) async {
    return _repository.getSalesOrderById(id);
  }

  Future<WineStockIn> createStockIn(WineStockIn stockIn, List<WineStockInItem> items) async {
    final created = await _repository.createStockIn(stockIn, items);
    await loadStockIns();
    await loadInventory();
    AutoSync.instance.notifyDataChanged();
    return created;
  }

  Future<WineSalesOrder> createSalesOrder(
      WineSalesOrder order, List<WineSalesOrderItem> items) async {
    final created = await _repository.createSalesOrder(order, items);
    await loadSalesOrders();
    await loadInventory();
    AutoSync.instance.notifyDataChanged();
    return created;
  }

  Future<void> deleteSalesOrder(String orderId) async {
    await _repository.deleteSalesOrder(orderId);
    await loadSalesOrders();
    await loadInventory();
    AutoSync.instance.notifyDataChanged();
  }

  Future<List<WineProductVariant>> getProductStock(String productId) async {
    return _repository.getProductStock(productId);
  }

  Future<List<WineStockInItem>> getVariantBatches(String productVariantId) async {
    return _repository.getVariantBatches(productVariantId);
  }

  Future<List<Map<String, dynamic>>> getTopProducts({int? limit}) async {
    return _repository.getTopProductsByVariant(limit: limit);
  }

  Future<List<Map<String, dynamic>>> getTopCustomers({int? limit}) async {
    return _repository.getTopCustomers(limit: limit);
  }
}
