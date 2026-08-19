import 'package:flutter/foundation.dart';
import '../models/wine_product.dart';
import '../models/wine_variant.dart';
import '../repositories/wine_product_repository.dart';
import '../../../services/auto_sync.dart';

class WineProductProvider extends ChangeNotifier {
  final WineProductRepository _repository = WineProductRepository();

  List<WineProduct> _products = [];
  List<WineVariantType> _variantTypes = [];
  List<WineVariantOption> _allVariantOptions = [];
  List<WineProductField> _productFields = [];
  WineProduct? _selectedProduct;
  bool _isLoading = false;

  List<WineProduct> get products => _products;
  List<WineVariantType> get variantTypes => _variantTypes;
  List<WineVariantOption> get allVariantOptions => _allVariantOptions;
  List<WineProductField> get productFields => _productFields;
  WineProduct? get selectedProduct => _selectedProduct;
  bool get isLoading => _isLoading;

  Future<void> loadProducts() async {
    _isLoading = true;
    notifyListeners();

    _products = await _repository.getAll();

    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadVariantTypes() async {
    _variantTypes = await _repository.getVariantTypes();
    _allVariantOptions = await _repository.getAllVariantOptions();
    notifyListeners();
  }

  Future<void> loadProductFields() async {
    _productFields = await _repository.getProductFields();
    notifyListeners();
  }

  Future<void> selectProduct(String id) async {
    _selectedProduct = await _repository.getWithVariants(id);
    notifyListeners();
  }

  // Product CRUD
  Future<WineProduct> addProduct(WineProduct product) async {
    final created = await _repository.insert(product);
    await loadProducts();
    AutoSync.instance.notifyDataChanged();
    return created;
  }

  Future<void> updateProduct(WineProduct product) async {
    await _repository.update(product);
    await loadProducts();
    AutoSync.instance.notifyDataChanged();
  }

  Future<void> deleteProduct(String id) async {
    await _repository.delete(id);
    await loadProducts();
    AutoSync.instance.notifyDataChanged();
  }

  // Variant management
  Future<WineProductVariant> addVariant(WineProductVariant variant) async {
    final created = await _repository.insertVariant(variant);
    if (_selectedProduct != null) {
      await selectProduct(_selectedProduct!.id);
    }
    return created;
  }

  Future<void> updateVariant(WineProductVariant variant) async {
    await _repository.updateVariant(variant);
    if (_selectedProduct != null) {
      await selectProduct(_selectedProduct!.id);
    }
  }

  Future<void> deleteVariant(String id) async {
    await _repository.deleteVariant(id);
    if (_selectedProduct != null) {
      await selectProduct(_selectedProduct!.id);
    }
  }

  // Variant options
  Future<WineVariantOption> addVariantOption(WineVariantOption option) async {
    final created = await _repository.insertVariantOption(option);
    await loadVariantTypes();
    return created;
  }

  Future<void> updateVariantOption(WineVariantOption option) async {
    await _repository.updateVariantOption(option);
    await loadVariantTypes();
  }

  Future<void> deleteVariantOption(String id) async {
    await _repository.deleteVariantOption(id);
    await loadVariantTypes();
  }

  // Dynamic fields
  Future<WineProductField> addField(WineProductField field) async {
    final created = await _repository.insertField(field);
    await loadProductFields();
    return created;
  }

  Future<void> updateField(WineProductField field) async {
    await _repository.updateField(field);
    await loadProductFields();
  }

  Future<void> deleteField(String id) async {
    await _repository.deleteField(id);
    await loadProductFields();
  }

  Future<void> saveFieldValues(String productId, Map<String, String> values) async {
    await _repository.saveProductFieldValues(productId, values);
  }

  Future<Map<String, String>> getFieldValues(String productId) async {
    return _repository.getProductFieldValues(productId);
  }
}
