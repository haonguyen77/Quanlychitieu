import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Manages wine color options (CRUD). Stored in SharedPreferences.
/// Default colors seeded from EXT's COLOR_CODES.
class WineColorService {
  WineColorService._();
  static final WineColorService instance = WineColorService._();

  static const _key = 'wine_color_options';
  static const _defaultColors = [
    'Da lươn',
    'Đen',
    'Hồng',
    'Trắng',
    'Xanh ngọc',
    'Xanh rêu',
    'Xanh bút bi',
    'Men trắng',
    'Men xanh',
  ];

  List<String>? _colors;

  /// Get all color options.
  Future<List<String>> getColors() async {
    _colors ??= await _load();
    return List.unmodifiable(_colors!);
  }

  /// Get colors synchronously (must call getColors() at least once before).
  List<String> getColorsSync() => List.unmodifiable(_colors ?? _defaultColors);

  /// Add a new color option.
  Future<void> addColor(String color) async {
    _colors ??= await _load();
    final trimmed = color.trim();
    if (trimmed.isEmpty || _colors!.contains(trimmed)) return;
    _colors!.add(trimmed);
    await _save();
  }

  /// Remove a color option.
  Future<void> removeColor(String color) async {
    _colors ??= await _load();
    _colors!.remove(color);
    await _save();
  }

  /// Rename a color option.
  Future<void> renameColor(String oldName, String newName) async {
    _colors ??= await _load();
    final idx = _colors!.indexOf(oldName);
    if (idx < 0) return;
    final trimmed = newName.trim();
    if (trimmed.isEmpty || _colors!.contains(trimmed)) return;
    _colors![idx] = trimmed;
    await _save();
  }

  Future<List<String>> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) return List.from(_defaultColors);
    try {
      return (jsonDecode(raw) as List<dynamic>).cast<String>();
    } catch (_) {
      return List.from(_defaultColors);
    }
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(_colors));
  }
}
