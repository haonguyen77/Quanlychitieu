import 'package:flutter/foundation.dart';
import '../models/app_module.dart';
import '../database/database_helper.dart';

/// ModuleProvider — loads module definitions from app_data (synced from EXT).
/// Falls back to hardcoded defaults if no synced data exists.
class ModuleProvider extends ChangeNotifier {
  List<AppModule> _modules = [];
  AppModule? _selectedModule;
  List<ModuleField> _selectedModuleFields = [];
  bool _isLoading = false;

  List<AppModule> get modules => _modules;
  AppModule? get selectedModule => _selectedModule;
  List<ModuleField> get selectedModuleFields => _selectedModuleFields;
  bool get isLoading => _isLoading;

  Future<void> loadModules() async {
    _isLoading = true;
    notifyListeners();

    try {
      final modulesJson = await DatabaseHelper.instance.getAppData('modules');
      if (modulesJson != null && modulesJson is List) {
        _modules = modulesJson.map<AppModule>((m) {
          final map = m as Map<String, dynamic>;
          return AppModule(
            id: map['id'] as String? ?? '',
            name: map['name'] as String? ?? '',
            icon: map['icon'] as String? ?? 'other',
            color: map['color'] as String? ?? '#607D8B',
            sortOrder: map['sortOrder'] as int? ?? 0,
            isDefault: map['isDefault'] as bool? ?? false,
            isActive: map['isActive'] as bool? ?? true,
          );
        }).toList();
      } else {
        // Fallback defaults
        _modules = _defaultModules();
      }
    } catch (e) {
      debugPrint('[ModuleProvider] Error loading modules: $e');
      _modules = _defaultModules();
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<void> selectModule(String id) async {
    _selectedModule = _modules.firstWhere((m) => m.id == id, orElse: () => _modules.first);
    _selectedModuleFields = []; // Fields are now in values_json, not separate table
    notifyListeners();
  }

  Future<List<ModuleField>> getModuleFields(String moduleId) async {
    // In new architecture, fields are defined in EXT's module definitions (app_data)
    // Return empty — fields are handled dynamically via values_json
    return [];
  }

  Future<AppModule> addModule(AppModule module) async {
    _modules.add(module);
    notifyListeners();
    return module;
  }

  Future<void> updateModule(AppModule module) async {
    final idx = _modules.indexWhere((m) => m.id == module.id);
    if (idx >= 0) _modules[idx] = module;
    notifyListeners();
  }

  Future<void> toggleModuleActive(String id, bool isActive) async {
    final idx = _modules.indexWhere((m) => m.id == id);
    if (idx >= 0) {
      _modules[idx] = _modules[idx].copyWith(isActive: isActive);
      notifyListeners();
    }
  }

  /// Alias for toggleModuleActive (used by settings screen)
  Future<void> toggleModule(String id, [bool? isActive]) async {
    final idx = _modules.indexWhere((m) => m.id == id);
    if (idx >= 0) {
      final newActive = isActive ?? !_modules[idx].isActive;
      _modules[idx] = _modules[idx].copyWith(isActive: newActive);
      notifyListeners();
    }
  }

  Future<void> deleteModule(String id) async {
    _modules.removeWhere((m) => m.id == id);
    notifyListeners();
  }

  Future<void> reorderFields(dynamic fields) async {
    // No-op in new architecture (fields are in EXT JSON)
  }

  Future<void> updateField(ModuleField field) async {
    // No-op in new architecture
  }

  Future<void> addField(ModuleField field) async {
    // No-op in new architecture
  }

  Future<void> deleteField(String fieldId) async {
    // No-op in new architecture
  }

  List<AppModule> _defaultModules() {
    final now = DateTime.now();
    return [
      AppModule(id: 'mod_chitieu', name: 'Chi tiêu', icon: 'expense', color: '#F44336', sortOrder: 0, isDefault: true, createdAt: now, updatedAt: now),
      AppModule(id: 'mod_shopee', name: 'Shopee', icon: 'shopee', color: '#FF5722', sortOrder: 1, isDefault: true, createdAt: now, updatedAt: now),
      AppModule(id: 'mod_vang', name: 'Vàng', icon: 'gold', color: '#FFC107', sortOrder: 2, isDefault: true, isActive: false, createdAt: now, updatedAt: now),
      AppModule(id: 'mod_nhatro', name: 'Nhà trọ', icon: 'rent', color: '#4CAF50', sortOrder: 3, isDefault: true, isActive: false, createdAt: now, updatedAt: now),
      AppModule(id: 'mod_ruou', name: 'Rượu', icon: 'other', color: '#9C27B0', sortOrder: 4, isDefault: true, isActive: false, createdAt: now, updatedAt: now),
      AppModule(id: 'mod_creditcard', name: 'Thẻ tín dụng', icon: 'card', color: '#1A237E', sortOrder: 5, isDefault: true, isActive: false, createdAt: now, updatedAt: now),
    ];
  }
}
