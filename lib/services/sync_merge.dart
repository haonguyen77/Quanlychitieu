/// Record-level merge engine for finance.json.
/// Compares records by UUID, resolves conflicts by updated_at timestamp.
/// MODULE CONFLICT RULE: If moduleId differs, REMOTE/EXT always wins.
///
import 'package:flutter/foundation.dart';
/// Strategy:
/// - Record exists only in local → add to remote
/// - Record exists only in remote → add to local
/// - Record exists in both → keep the one with newer updatedAt
/// - Deleted records (isDeleted=true) propagate to both sides
///
/// CRITICAL RULE: Never overwrite EXT-specific data the App doesn't manage.
/// The App only manages: records, accounts, and category membership within modules.
/// Everything else (fields, dashboard, reports, menu, settings, budgets,
/// recurringTransactions, activityLog, metadata) comes from EXT.
class SyncMergeEngine {
  SyncMergeEngine._();
  static final SyncMergeEngine instance = SyncMergeEngine._();

  /// Merge local finance.json with remote finance.json.
  /// Returns the merged result that should be saved to both sides.
  MergeResult merge(Map<String, dynamic> local, Map<String, dynamic> remote) {
    final result = MergeResult();

    // Start from remote as base to preserve ALL EXT-specific data
    final merged = Map<String, dynamic>.from(remote);

    // Merge records by UUID + updatedAt
    final localRecords = _toRecordList(local['records']);
    final remoteRecords = _toRecordList(remote['records']);
    merged['records'] = _mergeRecordLists(localRecords, remoteRecords, result);

    // Merge accounts by id + updatedAt
    final localAccounts = _toList(local['accounts']);
    final remoteAccounts = _toList(remote['accounts']);
    merged['accounts'] = _mergeByIdAndTimestamp(localAccounts, remoteAccounts);

    // Merge modules: PRESERVE remote field definitions, icon, color, tableConfig
    // Only merge categories from both sides
    final remoteModules = _toList(remote['modules']);
    final localModules = _toList(local['modules']);
    merged['modules'] = _mergeModules(localModules, remoteModules);

    // Update timestamp
    merged['lastModified'] = DateTime.now().toUtc().toIso8601String();

    // IMPORTANT: Do NOT overwrite these EXT-managed fields from local:
    // - settings (EXT manages theme, wineSettings, goldSettings, etc.)
    // - dashboard (EXT manages dashboard layout)
    // - reports (EXT manages report definitions)
    // - menu (EXT manages menu structure)
    // - recurringTransactions (EXT manages recurring)
    // - budgets (EXT manages budgets)
    // - activityLog (EXT manages logs)
    // - metadata (EXT manages metadata)
    // They are already preserved because we started from Map.from(remote)

    result.mergedData = merged;
    return result;
  }

  /// Merge two lists of DataRecords by UUID + updatedAt
  /// Merge two lists of DataRecords by UUID.
  /// RULE: If moduleId differs between local and remote → REMOTE wins (EXT is source of truth for module).
  /// RULE: If moduleId is the same → use updatedAt to resolve content conflict.
  List<Map<String, dynamic>> _mergeRecordLists(
    List<Map<String, dynamic>> local,
    List<Map<String, dynamic>> remote,
    MergeResult result,
  ) {
    final localMap = <String, Map<String, dynamic>>{};
    for (final rec in local) {
      final id = rec['id'] as String?;
      if (id != null) localMap[id] = rec;
    }

    final remoteMap = <String, Map<String, dynamic>>{};
    for (final rec in remote) {
      final id = rec['id'] as String?;
      if (id != null) remoteMap[id] = rec;
    }

    final merged = <String, Map<String, dynamic>>{};

    // Process all remote records
    for (final entry in remoteMap.entries) {
      final id = entry.key;
      final remoteRec = entry.value;

      if (localMap.containsKey(id)) {
        final localRec = localMap[id]!;
        final localModuleId = localRec['moduleId'] as String? ?? '';
        final remoteModuleId = remoteRec['moduleId'] as String? ?? '';

        // MODULE CONFLICT: different moduleId → REMOTE/EXT is source of truth
        if (localModuleId != remoteModuleId && remoteModuleId.isNotEmpty) {
          debugPrint('[SYNC-MODULE-CONFLICT] UUID=$id LOCAL_MODULE=$localModuleId REMOTE_MODULE=$remoteModuleId WINNER=REMOTE REASON=EXT_IS_SOURCE_OF_TRUTH');
          merged[id] = remoteRec;
          result.remoteWins++;
        } else {
          // Same module → use updatedAt for content conflict
          final localTime = _parseTime(localRec['updatedAt']);
          final remoteTime = _parseTime(remoteRec['updatedAt']);

          if (localTime.isAfter(remoteTime)) {
            merged[id] = localRec;
            result.localWins++;
          } else {
            merged[id] = remoteRec;
            result.remoteWins++;
          }
        }
      } else {
        // Only in remote → add
        merged[id] = remoteRec;
        result.addedFromRemote++;
      }
    }

    // Process local-only records
    for (final entry in localMap.entries) {
      if (!remoteMap.containsKey(entry.key)) {
        merged[entry.key] = entry.value;
        result.addedFromLocal++;
      }
    }

    return merged.values.toList();
  }

  /// Merge accounts/other entities by id + updatedAt
  List<Map<String, dynamic>> _mergeByIdAndTimestamp(
    List<Map<String, dynamic>> local,
    List<Map<String, dynamic>> remote,
  ) {
    final localMap = <String, Map<String, dynamic>>{};
    for (final item in local) {
      final id = item['id'] as String?;
      if (id != null) localMap[id] = item;
    }

    final remoteMap = <String, Map<String, dynamic>>{};
    for (final item in remote) {
      final id = item['id'] as String?;
      if (id != null) remoteMap[id] = item;
    }

    final merged = <String, Map<String, dynamic>>{};

    for (final entry in remoteMap.entries) {
      final id = entry.key;
      if (localMap.containsKey(id)) {
        final localTime = _parseTime(localMap[id]!['updatedAt']);
        final remoteTime = _parseTime(entry.value['updatedAt']);
        merged[id] = localTime.isAfter(remoteTime) ? localMap[id]! : entry.value;
      } else {
        merged[id] = entry.value;
      }
    }

    for (final entry in localMap.entries) {
      if (!remoteMap.containsKey(entry.key)) {
        merged[entry.key] = entry.value;
      }
    }

    return merged.values.toList();
  }

  /// Merge modules: PRESERVE all EXT-specific data (fields, icon, color, tableConfig, etc.)
  /// Only merge categories from both sides.
  List<Map<String, dynamic>> _mergeModules(
    List<Map<String, dynamic>> local,
    List<Map<String, dynamic>> remote,
  ) {
    final remoteMap = <String, Map<String, dynamic>>{};
    for (final mod in remote) {
      final id = mod['id'] as String?;
      if (id != null) remoteMap[id] = Map<String, dynamic>.from(mod);
    }

    final localMap = <String, Map<String, dynamic>>{};
    for (final mod in local) {
      final id = mod['id'] as String?;
      if (id != null) localMap[id] = mod;
    }

    // For each remote module: keep ALL its properties, only merge categories
    for (final entry in remoteMap.entries) {
      final localMod = localMap[entry.key];
      if (localMod != null) {
        // Merge categories from both sides
        final localCats = _toList(localMod['categories']);
        final remoteCats = _toList(entry.value['categories']);
        entry.value['categories'] = _mergeByIdAndTimestamp(localCats, remoteCats);
        // Keep ALL other remote module fields intact (fields, icon, color, tableConfig, etc.)
      }
    }

    // Add any local-only modules (App may have created new ones)
    for (final entry in localMap.entries) {
      if (!remoteMap.containsKey(entry.key)) {
        remoteMap[entry.key] = entry.value;
      }
    }

    return remoteMap.values.toList();
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  DateTime _parseTime(dynamic value) {
    if (value == null) return DateTime(2000);
    if (value is String && value.isNotEmpty) {
      return DateTime.tryParse(value) ?? DateTime(2000);
    }
    return DateTime(2000);
  }

  List<Map<String, dynamic>> _toRecordList(dynamic value) {
    if (value == null) return [];
    if (value is List) {
      return value.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  List<Map<String, dynamic>> _toList(dynamic value) {
    if (value == null) return [];
    if (value is List) {
      return value.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }
}

/// Result of a merge operation
class MergeResult {
  Map<String, dynamic>? mergedData;
  int addedFromLocal = 0;
  int addedFromRemote = 0;
  int localWins = 0;
  int remoteWins = 0;

  @override
  String toString() {
    return 'Merge: +$addedFromLocal local, +$addedFromRemote remote, '
        '$localWins local wins, $remoteWins remote wins';
  }
}
