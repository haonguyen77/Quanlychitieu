import 'package:flutter/foundation.dart';
import '../models/transaction.dart';
import '../repositories/transaction_repository.dart';
import '../services/auto_sync.dart';

class TransactionProvider extends ChangeNotifier {
  final TransactionRepository _repository = TransactionRepository();

  List<Transaction> _transactions = [];
  List<Transaction> _recentTransactions = [];
  List<Transaction> _deletedTransactions = [];
  Map<String, double> _todaySummary = {'income': 0, 'expense': 0, 'balance': 0};
  bool _isLoading = false;

  List<Transaction> get transactions => _transactions;
  List<Transaction> get recentTransactions => _recentTransactions;
  List<Transaction> get deletedTransactions => _deletedTransactions;
  Map<String, double> get todaySummary => _todaySummary;
  bool get isLoading => _isLoading;

  double get todayIncome => _todaySummary['income'] ?? 0;
  double get todayExpense => _todaySummary['expense'] ?? 0;
  double get todayBalance => _todaySummary['balance'] ?? 0;

  Future<void> loadTodaySummary() async {
    _todaySummary = await _repository.getTodaySummary();
    notifyListeners();
  }

  Future<void> loadRecentTransactions({int limit = 20}) async {
    _recentTransactions = await _repository.getAll(limit: limit);
    notifyListeners();
  }

  Future<void> loadTransactions({String? moduleId}) async {
    _isLoading = true;
    notifyListeners();

    _transactions = await _repository.getAll(moduleId: moduleId);

    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadByDateRange(DateTime start, DateTime end,
      {String? moduleId, String? categoryId, String? accountId}) async {
    _isLoading = true;
    notifyListeners();

    _transactions = await _repository.getByDateRange(start, end,
        moduleId: moduleId, categoryId: categoryId, accountId: accountId);

    _isLoading = false;
    notifyListeners();
  }

  Future<Transaction> addTransaction(Transaction transaction) async {
    final created = await _repository.insert(transaction);
    await loadTodaySummary();
    await loadRecentTransactions();
    AutoSync.instance.notifyDataChanged();
    return created;
  }

  Future<void> updateTransaction(Transaction transaction) async {
    await _repository.update(transaction);
    await loadTodaySummary();
    await loadRecentTransactions();
    AutoSync.instance.notifyDataChanged();
  }

  Future<void> deleteTransaction(String id) async {
    await _repository.softDelete(id);
    await loadTodaySummary();
    await loadRecentTransactions();
    AutoSync.instance.notifyDataChanged();
  }

  Future<void> restoreTransaction(String id) async {
    await _repository.restore(id);
    await loadTodaySummary();
    await loadRecentTransactions();
  }

  Future<void> permanentDeleteTransaction(String id) async {
    await _repository.permanentDelete(id);
    await loadDeletedTransactions();
  }

  Future<void> loadDeletedTransactions() async {
    _deletedTransactions = await _repository.getDeleted();
    notifyListeners();
  }

  Future<List<Transaction>> search({
    String? keyword,
    DateTime? startDate,
    DateTime? endDate,
    double? minAmount,
    double? maxAmount,
    String? categoryId,
    String? moduleId,
    String? accountId,
    String? tag,
  }) async {
    return _repository.search(
      keyword: keyword,
      startDate: startDate,
      endDate: endDate,
      minAmount: minAmount,
      maxAmount: maxAmount,
      categoryId: categoryId,
      moduleId: moduleId,
      accountId: accountId,
      tag: tag,
    );
  }

  Future<void> saveFieldValues(
      String transactionId, Map<String, String> values) async {
    await _repository.saveFieldValues(transactionId, values);
  }

  Future<Map<String, String>> getFieldValues(String transactionId) async {
    return _repository.getFieldValues(transactionId);
  }

  /// Get title suggestions matching a query, with associated category
  Future<List<Map<String, dynamic>>> getTitleSuggestions(String query) async {
    return _repository.getTitleSuggestions(query);
  }
}
