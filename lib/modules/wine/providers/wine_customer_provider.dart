import 'package:flutter/foundation.dart';
import '../models/wine_customer.dart';
import '../repositories/wine_customer_repository.dart';

class WineCustomerProvider extends ChangeNotifier {
  final WineCustomerRepository _repository = WineCustomerRepository();

  List<WineCustomer> _customers = [];
  bool _isLoading = false;

  List<WineCustomer> get customers => _customers;
  bool get isLoading => _isLoading;

  Future<void> loadCustomers() async {
    _isLoading = true;
    notifyListeners();

    _customers = await _repository.getAll();

    _isLoading = false;
    notifyListeners();
  }

  Future<List<WineCustomer>> search(String keyword) async {
    return _repository.search(keyword);
  }

  Future<WineCustomer> addCustomer(WineCustomer customer) async {
    final created = await _repository.insert(customer);
    await loadCustomers();
    return created;
  }

  Future<void> updateCustomer(WineCustomer customer) async {
    await _repository.update(customer);
    await loadCustomers();
  }

  Future<void> deleteCustomer(String id) async {
    await _repository.delete(id);
    await loadCustomers();
  }
}
