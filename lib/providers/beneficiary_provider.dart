import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../models/beneficiary.dart';
import '../repositories/beneficiary_repository.dart';
import '../database/database_helper.dart';

class BeneficiaryProvider extends ChangeNotifier {
  final BeneficiaryRepository _repository = BeneficiaryRepository();
  final _uuid = const Uuid();

  List<Beneficiary> _beneficiaries = [];
  List<Beneficiary> _activeBeneficiaries = [];
  bool _isLoading = false;

  List<Beneficiary> get beneficiaries => _beneficiaries;
  List<Beneficiary> get activeBeneficiaries => _activeBeneficiaries;
  bool get isLoading => _isLoading;

  Future<void> loadBeneficiaries() async {
    _isLoading = true;
    notifyListeners();

    // Auto-sync beneficiaries from transactions on first load
    await _syncFromTransactions();

    _beneficiaries = await _repository.getAll();
    _activeBeneficiaries = _beneficiaries.where((b) => b.isActive).toList();

    _isLoading = false;
    notifyListeners();
  }

  /// Sync beneficiary names from transactions table into beneficiaries table.
  /// Only adds names that don't already exist.
  Future<void> _syncFromTransactions() async {
    try {
      final db = await DatabaseHelper.instance.database;
      // Get distinct beneficiary names from transactions
      final result = await db.rawQuery('''
        SELECT DISTINCT beneficiary FROM transactions 
        WHERE beneficiary IS NOT NULL AND beneficiary != '' AND is_deleted = 0
      ''');
      
      if (result.isEmpty) return;

      // Get existing beneficiary names
      final existing = await db.rawQuery('SELECT name FROM beneficiaries');
      final existingNames = existing.map((r) => (r['name'] as String).toLowerCase()).toSet();

      final now = DateTime.now().toIso8601String();
      for (final row in result) {
        final name = (row['beneficiary'] as String? ?? '').trim();
        if (name.isEmpty || existingNames.contains(name.toLowerCase())) continue;
        
        await db.insert('beneficiaries', {
          'id': _uuid.v4(),
          'name': name,
          'is_active': 1,
          'sort_order': 0,
          'created_at': now,
          'updated_at': now,
        });
        existingNames.add(name.toLowerCase());
      }
    } catch (e) {
      debugPrint('[BeneficiaryProvider] Sync from transactions error: $e');
    }
  }

  Future<List<Beneficiary>> search(String query) async {
    return _repository.search(query);
  }

  Future<void> addBeneficiary(Beneficiary beneficiary) async {
    await _repository.insert(beneficiary);
    await loadBeneficiaries();
  }

  Future<void> updateBeneficiary(Beneficiary beneficiary) async {
    await _repository.update(beneficiary);
    await loadBeneficiaries();
  }

  Future<void> deleteBeneficiary(String id) async {
    await _repository.delete(id);
    await loadBeneficiaries();
  }

  Future<void> toggleActive(String id, bool isActive) async {
    await _repository.toggleActive(id, isActive);
    await loadBeneficiaries();
  }
}
