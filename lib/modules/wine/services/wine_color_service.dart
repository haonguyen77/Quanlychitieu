import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../database/database_helper.dart';

/// Manages wine color options (CRUD).
///
/// Source of truth is the synced palette in finance.json: app_data key
/// `wineColorPalette` = [{code,label}]. This is shared across app / extension /
/// webapp via Google Drive sync.
///
/// SharedPreferences (`wine_color_options`, labels-only) is kept ONLY as a
/// one-time migration fallback for older installs — it is no longer the
/// long-term source.
///
/// The Flutter UI works with labels; internally we keep a stable `code` per
/// color so the palette can be merged by code with the other platforms.
/// Changing the palette here does NOT change color values already stored on
/// order/product/inventory records — it only changes the selectable list.
class WineColorService {
  WineColorService._();
  static final WineColorService instance = WineColorService._();

  static const _legacyKey = 'wine_color_options';

  /// Defaults aligned with EXT/webapp codes so a merge unions cleanly.
  static const _defaultPalette = <Map<String, String>>[
    {'code': 'DL', 'label': 'Da lươn'},
    {'code': 'DEN', 'label': 'Đen'},
    {'code': 'HONG', 'label': 'Hồng'},
    {'code': 'TRANG', 'label': 'Trắng'},
    {'code': 'XN', 'label': 'Xanh ngọc'},
    {'code': 'XR', 'label': 'Xanh rêu'},
    {'code': 'XBB', 'label': 'Xanh bút bi'},
    {'code': 'MT', 'label': 'Men trắng'},
    {'code': 'MX', 'label': 'Men xanh'},
  ];

  /// In-memory palette: list of {code,label}.
  List<Map<String, String>>? _palette;

  final _db = DatabaseHelper.instance;

  /// Get all color labels (UI-facing).
  Future<List<String>> getColors() async {
    _palette ??= await _load();
    return List.unmodifiable(_palette!.map((c) => c['label'] ?? '').where((l) => l.isNotEmpty));
  }

  /// Get labels synchronously (call getColors() at least once first).
  List<String> getColorsSync() {
    final p = _palette ?? _defaultPalette;
    return List.unmodifiable(p.map((c) => c['label'] ?? '').where((l) => l.isNotEmpty));
  }

  /// Add a new color (by label). Generates a stable code from the label.
  Future<void> addColor(String color) async {
    _palette ??= await _load();
    final trimmed = color.trim();
    if (trimmed.isEmpty) return;
    if (_palette!.any((c) => c['label'] == trimmed)) return;
    _palette!.add({'code': _makeCode(trimmed), 'label': trimmed});
    await _save();
  }

  /// Remove a color by label.
  Future<void> removeColor(String color) async {
    _palette ??= await _load();
    _palette!.removeWhere((c) => c['label'] == color);
    await _save();
  }

  /// Rename a color's label. Keeps the existing code so the palette entry
  /// stays identifiable across syncs.
  Future<void> renameColor(String oldName, String newName) async {
    _palette ??= await _load();
    final idx = _palette!.indexWhere((c) => c['label'] == oldName);
    if (idx < 0) return;
    final trimmed = newName.trim();
    if (trimmed.isEmpty) return;
    if (_palette!.any((c) => c['label'] == trimmed)) return;
    _palette![idx] = {'code': _palette![idx]['code'] ?? _makeCode(trimmed), 'label': trimmed};
    await _save();
  }

  /// Force a reload from DB next access (e.g. after a sync import).
  void invalidateCache() {
    _palette = null;
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  Future<List<Map<String, String>>> _load() async {
    // 1) Prefer synced palette from app_data.
    try {
      final raw = await _db.getAppData('wineColorPalette');
      if (raw is List && raw.isNotEmpty) {
        final parsed = raw
            .whereType<Map>()
            .map((m) => {
                  'code': (m['code'] ?? '').toString(),
                  'label': (m['label'] ?? '').toString(),
                })
            .where((m) => m['label']!.isNotEmpty)
            .toList();
        if (parsed.isNotEmpty) return parsed;
      }
    } catch (_) {}

    // 2) Migration fallback: legacy SharedPreferences (labels only).
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_legacyKey);
      if (raw != null) {
        final labels = (jsonDecode(raw) as List<dynamic>).cast<String>();
        if (labels.isNotEmpty) {
          final migrated = labels.map((l) => {'code': _codeForLabel(l), 'label': l}).toList();
          // Persist migrated palette to app_data so it syncs going forward.
          await _db.setAppData('wineColorPalette', migrated);
          return migrated;
        }
      }
    } catch (_) {}

    // 3) Defaults — also persist so it becomes the synced source.
    final defaults = _defaultPalette.map((m) => Map<String, String>.from(m)).toList();
    try {
      await _db.setAppData('wineColorPalette', defaults);
    } catch (_) {}
    return defaults;
  }

  Future<void> _save() async {
    if (_palette == null) return;
    // Write to app_data (synced source of truth).
    await _db.setAppData('wineColorPalette', _palette);
    // Mirror labels to legacy prefs for backward compat (not the source).
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_legacyKey, jsonEncode(_palette!.map((c) => c['label']).toList()));
    } catch (_) {}
  }

  /// Map a known default label to its EXT code; otherwise generate one.
  String _codeForLabel(String label) {
    for (final d in _defaultPalette) {
      if (d['label'] == label) return d['code']!;
    }
    return _makeCode(label);
  }

  /// Generate a stable uppercase ASCII code from a label (diacritics stripped).
  String _makeCode(String label) {
    final noDiacritics = _stripDiacritics(label.trim());
    final letters = noDiacritics.replaceAll(RegExp(r'[^A-Za-z0-9]'), '').toUpperCase();
    final base = letters.isEmpty ? 'C' : letters;
    // Keep it short but reasonably unique.
    var code = base.length > 6 ? base.substring(0, 6) : base;
    // Ensure uniqueness against current palette.
    final existing = (_palette ?? const <Map<String, String>>[]).map((c) => c['code']).toSet();
    var candidate = code;
    var i = 1;
    while (existing.contains(candidate)) {
      candidate = '$code$i';
      i++;
    }
    return candidate;
  }

  String _stripDiacritics(String input) {
    const from = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ'
        'ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ';
    const to = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
        'AAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYD';
    final buffer = StringBuffer();
    for (final ch in input.split('')) {
      final idx = from.indexOf(ch);
      buffer.write(idx >= 0 ? to[idx] : ch);
    }
    return buffer.toString();
  }
}
