import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Tracks usage frequency and recency for accounts, categories, and modules.
/// Sorts items by frequency (most-used first), with recency as tiebreaker.
///
/// Storage: SharedPreferences JSON maps
///   - usage_freq_account: { "acc_cash": { "count": 15, "lastUsed": "2024-..." } }
///   - usage_freq_category: { "cat_muasam": { ... } }
///   - usage_freq_module: { "mod_chitieu": { ... } }
class UsageFrequencyService {
  UsageFrequencyService._();
  static final UsageFrequencyService instance = UsageFrequencyService._();

  static const _keyPrefix = 'usage_freq_';
  static const _accountKey = '${_keyPrefix}account';
  static const _categoryKey = '${_keyPrefix}category';
  static const _moduleKey = '${_keyPrefix}module';

  Map<String, _UsageEntry>? _accountFreq;
  Map<String, _UsageEntry>? _categoryFreq;
  Map<String, _UsageEntry>? _moduleFreq;

  /// Record that user selected this account for a transaction.
  Future<void> recordAccountUsage(String? accountId) async {
    if (accountId == null || accountId.isEmpty) return;
    _accountFreq ??= await _load(_accountKey);
    _increment(_accountFreq!, accountId);
    await _save(_accountKey, _accountFreq!);
  }

  /// Record that user selected this category for a transaction.
  Future<void> recordCategoryUsage(String? categoryId) async {
    if (categoryId == null || categoryId.isEmpty) return;
    _categoryFreq ??= await _load(_categoryKey);
    _increment(_categoryFreq!, categoryId);
    await _save(_categoryKey, _categoryFreq!);
  }

  /// Record that user selected this module for a transaction.
  Future<void> recordModuleUsage(String? moduleId) async {
    if (moduleId == null || moduleId.isEmpty) return;
    _moduleFreq ??= await _load(_moduleKey);
    _increment(_moduleFreq!, moduleId);
    await _save(_moduleKey, _moduleFreq!);
  }

  /// Record usage for all three at once (convenience for after saving a transaction).
  Future<void> recordTransactionUsage({
    String? accountId,
    String? categoryId,
    String? moduleId,
  }) async {
    await Future.wait([
      recordAccountUsage(accountId),
      recordCategoryUsage(categoryId),
      recordModuleUsage(moduleId),
    ]);
  }

  /// Sort a list of items by usage frequency (most-used first).
  /// [getId] extracts the ID from each item.
  /// Items not in frequency map are placed at the end in original order.
  Future<List<T>> sortByAccountFrequency<T>(List<T> items, String Function(T) getId) async {
    _accountFreq ??= await _load(_accountKey);
    return _sortByFrequency(items, getId, _accountFreq!);
  }

  Future<List<T>> sortByCategoryFrequency<T>(List<T> items, String Function(T) getId) async {
    _categoryFreq ??= await _load(_categoryKey);
    return _sortByFrequency(items, getId, _categoryFreq!);
  }

  Future<List<T>> sortByModuleFrequency<T>(List<T> items, String Function(T) getId) async {
    _moduleFreq ??= await _load(_moduleKey);
    return _sortByFrequency(items, getId, _moduleFreq!);
  }

  /// Synchronous sort (requires data to be pre-loaded via any record* or sort* call).
  List<T> sortByAccountFrequencySync<T>(List<T> items, String Function(T) getId) {
    return _sortByFrequency(items, getId, _accountFreq ?? {});
  }

  List<T> sortByCategoryFrequencySync<T>(List<T> items, String Function(T) getId) {
    return _sortByFrequency(items, getId, _categoryFreq ?? {});
  }

  List<T> sortByModuleFrequencySync<T>(List<T> items, String Function(T) getId) {
    return _sortByFrequency(items, getId, _moduleFreq ?? {});
  }

  /// Pre-load all frequency data (call once at app startup).
  Future<void> init() async {
    _accountFreq = await _load(_accountKey);
    _categoryFreq = await _load(_categoryKey);
    _moduleFreq = await _load(_moduleKey);
  }

  // ─── Private ────────────────────────────────────────────────────────────

  List<T> _sortByFrequency<T>(List<T> items, String Function(T) getId, Map<String, _UsageEntry> freq) {
    if (freq.isEmpty) return items;

    final sorted = List<T>.from(items);
    sorted.sort((a, b) {
      final fa = freq[getId(a)];
      final fb = freq[getId(b)];

      // Items with usage data come first
      if (fa == null && fb == null) return 0;
      if (fa == null) return 1;
      if (fb == null) return -1;

      // Higher count first
      final countCmp = fb.count.compareTo(fa.count);
      if (countCmp != 0) return countCmp;

      // More recent first (tiebreaker)
      return fb.lastUsed.compareTo(fa.lastUsed);
    });
    return sorted;
  }

  void _increment(Map<String, _UsageEntry> freq, String id) {
    final existing = freq[id];
    final now = DateTime.now().toIso8601String();
    if (existing != null) {
      freq[id] = _UsageEntry(count: existing.count + 1, lastUsed: now);
    } else {
      freq[id] = _UsageEntry(count: 1, lastUsed: now);
    }
  }

  Future<Map<String, _UsageEntry>> _load(String key) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(key);
    if (raw == null) return {};

    try {
      final map = jsonDecode(raw) as Map<String, dynamic>;
      return map.map((k, v) {
        final entry = v as Map<String, dynamic>;
        return MapEntry(k, _UsageEntry(
          count: entry['count'] as int? ?? 0,
          lastUsed: entry['lastUsed'] as String? ?? '',
        ));
      });
    } catch (_) {
      return {};
    }
  }

  Future<void> _save(String key, Map<String, _UsageEntry> freq) async {
    final prefs = await SharedPreferences.getInstance();
    final map = freq.map((k, v) => MapEntry(k, {
      'count': v.count,
      'lastUsed': v.lastUsed,
    }));
    await prefs.setString(key, jsonEncode(map));
  }
}

class _UsageEntry {
  final int count;
  final String lastUsed;

  _UsageEntry({required this.count, required this.lastUsed});
}
