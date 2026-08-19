import 'package:flutter/foundation.dart' hide Category;
import '../models/category.dart';
import '../database/database_helper.dart';
import '../utils/icon_helper.dart';

/// CategoryProvider — loads categories from synced module definitions in app_data.
class CategoryProvider extends ChangeNotifier {
  List<Category> _expenseCategories = [];
  List<Category> _incomeCategories = [];
  List<Category> _allCategories = [];
  bool _isLoading = false;

  List<Category> get expenseCategories => _expenseCategories;
  List<Category> get incomeCategories => _incomeCategories;
  List<Category> get allCategories => _allCategories;
  bool get isLoading => _isLoading;

  Future<void> loadCategories() async {
    _isLoading = true;
    notifyListeners();

    try {
      final modulesJson = await DatabaseHelper.instance.getAppData('modules');
      final List<Category> cats = [];

      if (modulesJson != null && modulesJson is List) {
        for (final mod in modulesJson) {
          final modMap = mod as Map<String, dynamic>;
          final categories = modMap['categories'] as List<dynamic>? ?? [];
          for (final cat in categories) {
            final catMap = cat as Map<String, dynamic>;
            if (catMap['isActive'] == false) continue;
            cats.add(Category(
              id: catMap['id'] as String? ?? '',
              name: catMap['name'] as String? ?? '',
              icon: catMap['icon'] as String? ?? 'other',
              color: catMap['color'] as String? ?? '#607D8B',
              parentId: catMap['parentId'] as String?,
              type: 0,
              sortOrder: catMap['sortOrder'] as int? ?? 0,
              isActive: true,
              createdAt: DateTime.tryParse(catMap['createdAt'] as String? ?? '') ?? DateTime.now(),
              updatedAt: DateTime.tryParse(catMap['updatedAt'] as String? ?? '') ?? DateTime.now(),
            ));
          }
        }
      }

      // Deduplicate by name: keep the one with a recognized icon
      final deduped = _deduplicateByName(cats);

      _allCategories = deduped;
      _expenseCategories = deduped; // EXT doesn't distinguish expense/income categories
      _incomeCategories = [];
    } catch (e) {
      debugPrint('[CategoryProvider] Error: $e');
      _allCategories = [];
      _expenseCategories = [];
      _incomeCategories = [];
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Deduplicate categories by name.
  /// If multiple categories share the same name, prefer the one whose icon
  /// is recognized in IconHelper (not the default fallback).
  List<Category> _deduplicateByName(List<Category> cats) {
    final byName = <String, Category>{};
    for (final cat in cats) {
      final name = cat.name.toLowerCase().trim();
      if (!byName.containsKey(name)) {
        byName[name] = cat;
      } else {
        // Keep the one with a recognized icon
        final existing = byName[name]!;
        final existingHasIcon = IconHelper.iconMap.containsKey(existing.icon);
        final newHasIcon = IconHelper.iconMap.containsKey(cat.icon);
        if (!existingHasIcon && newHasIcon) {
          byName[name] = cat;
        }
        // If both have icons or neither has, keep existing (first wins)
      }
    }
    return byName.values.toList();
  }

  Future<List<Category>> getChildCategories(String parentId) async {
    return _allCategories.where((c) => c.parentId == parentId).toList();
  }

  Category? getCategoryById(String id) {
    try { return _allCategories.firstWhere((c) => c.id == id); } catch (_) { return null; }
  }

  Future<Category> addCategory(Category category) async {
    _allCategories.add(category);
    _expenseCategories = _deduplicateByName(_allCategories);
    await _persistCategoriesToAppData();
    notifyListeners();
    return category;
  }

  Future<void> updateCategory(Category category) async {
    final idx = _allCategories.indexWhere((c) => c.id == category.id);
    if (idx >= 0) _allCategories[idx] = category;
    _expenseCategories = _deduplicateByName(_allCategories);
    await _persistCategoriesToAppData();
    notifyListeners();
  }

  Future<void> deleteCategory(String id) async {
    _allCategories.removeWhere((c) => c.id == id);
    _expenseCategories = _deduplicateByName(_allCategories);
    await _persistCategoriesToAppData();
    notifyListeners();
  }

  /// Persist current categories back to app_data.modules so they get exported on sync.
  Future<void> _persistCategoriesToAppData() async {
    try {
      final modulesJson = await DatabaseHelper.instance.getAppData('modules');
      if (modulesJson == null || modulesJson is! List) return;

      // Update the first module's categories (mod_chitieu)
      final modules = List<Map<String, dynamic>>.from(modulesJson.map((m) => Map<String, dynamic>.from(m as Map)));
      
      // Find mod_chitieu module and update its categories
      for (int i = 0; i < modules.length; i++) {
        if (modules[i]['id'] == 'mod_chitieu') {
          modules[i]['categories'] = _allCategories.map((c) => {
            'id': c.id,
            'name': c.name,
            'icon': c.icon,
            'color': c.color,
            'parentId': c.parentId,
            'sortOrder': c.sortOrder,
            'isActive': c.isActive,
            'createdAt': c.createdAt.toIso8601String(),
            'updatedAt': c.updatedAt.toIso8601String(),
          }).toList();
          break;
        }
      }

      await DatabaseHelper.instance.setAppData('modules', modules);
    } catch (e) {
      debugPrint('[CategoryProvider] Error persisting to app_data: $e');
    }
  }
}
