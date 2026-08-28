import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:googleapis/drive/v3.dart' as drive;
import 'package:googleapis_auth/googleapis_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../database/database_helper.dart';
import 'crypto_service.dart';

/// Sync status enum
enum SyncStatus { idle, syncing, success, error }

/// Simple sync service: downloads finance.json from Drive, imports into DB.
/// Exports DB back to finance.json, uploads to Drive.
/// NO complex merging — just mirrors EXT's approach.
class SyncService {
  SyncService._();
  static final SyncService instance = SyncService._();

  static const _deviceIdKey = 'sync_device_id';
  static const _lastSyncKey = 'sync_last_modified';
  static const _financeFileName = 'finance.json';
  static const _folderName = 'QLCT';

  String? _deviceId;
  SyncStatus _status = SyncStatus.idle;
  String _lastMessage = '';
  final List<VoidCallback> _listeners = [];

  SyncStatus get status => _status;
  String get lastMessage => _lastMessage;

  void addListener(VoidCallback listener) => _listeners.add(listener);
  void removeListener(VoidCallback listener) => _listeners.remove(listener);
  void _notify() { for (final l in _listeners) l(); }

  Future<String> getDeviceId() async {
    if (_deviceId != null) return _deviceId!;
    final prefs = await SharedPreferences.getInstance();
    _deviceId = prefs.getString(_deviceIdKey);
    if (_deviceId == null) {
      _deviceId = 'android_${const Uuid().v4().substring(0, 8)}';
      await prefs.setString(_deviceIdKey, _deviceId!);
    }
    return _deviceId!;
  }

  Future<String?> getLastSyncTimestamp() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_lastSyncKey);
  }

  Future<void> _setLastSyncTimestamp(String timestamp) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_lastSyncKey, timestamp);
  }

  Future<Map<String, dynamic>?> downloadFinanceJson(GoogleSignInAccount user) async {
    return _downloadFinanceJson(user);
  }

  /// Public raw fetch (no decryption) — used by the PIN unlock flow to obtain
  /// the encrypted envelope for establishFromEnvelope onboarding.
  Future<Map<String, dynamic>?> fetchRemoteRaw(GoogleSignInAccount user) async {
    return _fetchRemoteRaw(user);
  }

  Future<void> setLastSyncTimestamp(String timestamp) async {
    await _setLastSyncTimestamp(timestamp);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL SYNC — 2-way merge by UUID + updatedAt
  // ═══════════════════════════════════════════════════════════════════════════

  Future<String> fullSync(GoogleSignInAccount user) async {
    if (_status == SyncStatus.syncing) return 'Đang đồng bộ...';
    _status = SyncStatus.syncing;
    _lastMessage = 'Đang đồng bộ...';
    _notify();

    try {
      final db = DatabaseHelper.instance;

      // Step 1: Export local data
      debugPrint('[SYNC] Exporting local data...');
      final localData = await db.exportFinanceJson();
      final localRecCount = (localData['records'] as List?)?.length ?? 0;
      debugPrint('[SYNC] Local export: $localRecCount records');

      // Step 2: Download remote finance.json (raw, then decrypt if needed)
      debugPrint('[SYNC] Downloading remote...');
      final crypto = CryptoService.instance;
      final remoteRaw = await _fetchRemoteRaw(user);
      // SAFETY: encrypted remote we can't read yet → abort (never clobber ciphertext).
      if (remoteRaw != null &&
          crypto.isEncryptedEnvelope(remoteRaw) &&
          !crypto.hasKey()) {
        _status = SyncStatus.error;
        _lastMessage = 'Dữ liệu Drive đã mã hóa — cần nhập mã PIN để đồng bộ.';
        _notify();
        return _lastMessage;
      }
      Map<String, dynamic>? remoteData;
      if (remoteRaw != null) {
        remoteData = crypto.isEncryptedEnvelope(remoteRaw)
            ? await crypto.decryptData(remoteRaw)
            : remoteRaw;
      }

      Map<String, dynamic> dataToUpload;

      if (remoteData == null) {
        // No remote — upload local (first sync)
        dataToUpload = localData;
        dataToUpload['deviceId'] = await getDeviceId();
        debugPrint('[SYNC] No remote, uploading local');
      } else {
        // Merge: remote is base, add local-only records
        debugPrint('[SYNC] Merging...');
        dataToUpload = _merge(localData, remoteData);
      }

      // Step 3: (Removed old 50%-safety reimport-remote guard.)
      // The merge is a per-record UNION by id — it can only have fewer records
      // than remote when records were soft-deleted (legitimate tombstones).
      // The old guard discarded freshly-added local records that hadn't been
      // pushed yet ("nhập chi tiêu → đồng bộ → mất"). We trust the union merge.
      final mergedRecordCount = (dataToUpload['records'] as List?)?.length ?? 0;

      // Step 4: Upload merged
      debugPrint('[SYNC] Uploading...');
      final uploaded = await _uploadFinanceJson(user, dataToUpload);
      if (!uploaded) {
        _status = SyncStatus.error;
        _lastMessage = 'Upload thất bại';
        _notify();
        return _lastMessage;
      }

      // Step 5: Import merged into local DB
      debugPrint('[SYNC] Importing merged into DB...');
      await db.importFinanceJson(dataToUpload);

      // Step 6: Save timestamp
      await _setLastSyncTimestamp(
        dataToUpload['lastModified'] as String? ?? DateTime.now().toUtc().toIso8601String()
      );

      _status = SyncStatus.success;
      // Count sync stats
      final localRecordCount = (localData['records'] as List?)?.length ?? 0;
      final remoteRecordCount2 = remoteData != null ? ((remoteData['records'] as List?)?.length ?? 0) : 0;
      final addedToRemote = mergedRecordCount > remoteRecordCount2 ? mergedRecordCount - remoteRecordCount2 : 0;
      final addedFromRemote = mergedRecordCount > localRecordCount ? mergedRecordCount - localRecordCount : 0;
      // Count updated records (local newer than remote)
      int updatedCount = 0;
      if (remoteData != null) {
        final remoteRecords = (remoteData['records'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
        final remoteMap = <String, String>{};
        for (final r in remoteRecords) { remoteMap[r['id'] as String? ?? ''] = r['updatedAt'] as String? ?? ''; }
        final localRecords = (localData['records'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
        for (final r in localRecords) {
          final id = r['id'] as String? ?? '';
          if (remoteMap.containsKey(id)) {
            final lt = r['updatedAt'] as String? ?? '';
            final rt = remoteMap[id] ?? '';
            if (lt.compareTo(rt) > 0) updatedCount++;
          }
        }
      }
      _lastMessage = '✓ ${addedToRemote > 0 ? "$addedToRemote mới" : ""}${updatedCount > 0 ? " $updatedCount cập nhật" : ""} lên Drive | ${addedFromRemote > 0 ? "$addedFromRemote từ Drive" : "0 từ Drive"} ($mergedRecordCount giao dịch)';
      if (addedToRemote == 0 && updatedCount == 0 && addedFromRemote == 0) {
        _lastMessage = '✓ Đã đồng bộ — không có thay đổi ($mergedRecordCount giao dịch)';
      }
      _notify();
      return _lastMessage;

    } catch (e) {
      debugPrint('[SYNC] Error: $e');
      _status = SyncStatus.error;
      _lastMessage = 'Lỗi: $e';
      _notify();
      return _lastMessage;
    }
  }

  /// Quick push: export local → merge with remote → upload
  Future<void> quickPush(GoogleSignInAccount user) async {
    try {
      final db = DatabaseHelper.instance;
      final localData = await db.exportFinanceJson();
      localData['deviceId'] = await getDeviceId();

      final crypto = CryptoService.instance;
      final remoteRaw = await _fetchRemoteRaw(user);
      // SAFETY: don't overwrite an encrypted Drive envelope with plaintext when locked.
      if (remoteRaw != null &&
          crypto.isEncryptedEnvelope(remoteRaw) &&
          !crypto.hasKey()) {
        debugPrint('[SYNC] Quick push aborted: remote is encrypted and locked');
        return;
      }
      final remoteData = (remoteRaw != null && crypto.isEncryptedEnvelope(remoteRaw))
          ? await crypto.decryptData(remoteRaw)
          : remoteRaw;
      Map<String, dynamic> dataToUpload;

      if (remoteData != null) {
        dataToUpload = _merge(localData, remoteData);
      } else {
        dataToUpload = localData;
      }

      await _uploadFinanceJson(user, dataToUpload);
      // Write the merged result back to the local DB so records pulled in from
      // remote during this push are not lost on the next open (previously
      // quickPush uploaded the merge but never re-imported it locally).
      if (remoteData != null) {
        await db.importFinanceJson(dataToUpload);
      }
      await _setLastSyncTimestamp(DateTime.now().toUtc().toIso8601String());
    } catch (e) {
      debugPrint('[SYNC] Quick push error: $e');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MERGE — same as EXT: UUID + updatedAt, remote as base
  // ═══════════════════════════════════════════════════════════════════════════

  Map<String, dynamic> _merge(Map<String, dynamic> local, Map<String, dynamic> remote) {
    // Start from remote (preserves all EXT-specific data)
    final merged = Map<String, dynamic>.from(remote);

    // Merge records by UUID + updatedAt
    final localRecords = (local['records'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();
    final remoteRecords = (remote['records'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();

    final localMap = <String, Map<String, dynamic>>{};
    for (final r in localRecords) {
      final id = r['id'] as String?;
      if (id != null) localMap[id] = r;
    }
    final remoteMap = <String, Map<String, dynamic>>{};
    for (final r in remoteRecords) {
      final id = r['id'] as String?;
      if (id != null) remoteMap[id] = r;
    }

    final mergedRecords = <String, Map<String, dynamic>>{};

    // All remote records (remote wins on equal timestamps)
    for (final entry in remoteMap.entries) {
      final id = entry.key;
      if (localMap.containsKey(id)) {
        final localRec = localMap[id]!;
        final remoteRec = entry.value;
        final localModuleId = localRec['moduleId'] as String? ?? '';
        final remoteModuleId = remoteRec['moduleId'] as String? ?? '';

        // MODULE CONFLICT: if moduleId differs, remote (EXT) is source of truth
        if (localModuleId != remoteModuleId && remoteModuleId.isNotEmpty) {
          mergedRecords[id] = remoteRec;
        } else {
          // Same module: use updatedAt to resolve (last-write-wins).
          final lt = _parseTime(localRec['updatedAt']);
          final rt = _parseTime(remoteRec['updatedAt']);
          if (lt.isAfter(rt)) {
            mergedRecords[id] = localRec;
          } else if (rt.isAfter(lt)) {
            mergedRecords[id] = remoteRec;
          } else {
            // Exact tie: tombstone wins so a delete isn't silently undone;
            // otherwise keep local (this device's edit).
            final localDeleted = localRec['isDeleted'] == true;
            final remoteDeleted = remoteRec['isDeleted'] == true;
            if (localDeleted && !remoteDeleted) {
              mergedRecords[id] = localRec;
            } else if (remoteDeleted && !localDeleted) {
              mergedRecords[id] = remoteRec;
            } else {
              mergedRecords[id] = localRec;
            }
          }
        }
      } else {
        mergedRecords[id] = entry.value;
      }
    }

    // Local-only records
    for (final entry in localMap.entries) {
      if (!remoteMap.containsKey(entry.key)) {
        mergedRecords[entry.key] = entry.value;
      }
    }

    merged['records'] = mergedRecords.values.toList();

    // Merge accounts by id + updatedAt
    final localAccounts = (local['accounts'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    final remoteAccounts = (remote['accounts'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    merged['accounts'] = _mergeById(localAccounts, remoteAccounts);

    // Merge modules by id (union) so locally-created modules aren't wiped out
    // by remote. Remote is base; add any local-only module (e.g. "Tiết Kiệm").
    final localModules = (local['modules'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    final remoteModules = (remote['modules'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    if (localModules.isNotEmpty || remoteModules.isNotEmpty) {
      final byId = <String, Map<String, dynamic>>{};
      for (final m in remoteModules) {
        final id = m['id'] as String?;
        if (id != null) byId[id] = m;
      }
      for (final m in localModules) {
        final id = m['id'] as String?;
        if (id != null && !byId.containsKey(id)) byId[id] = m; // add local-only
      }
      merged['modules'] = byId.values.toList();
    }

    merged['lastModified'] = DateTime.now().toUtc().toIso8601String();

    return merged;
  }

  List<Map<String, dynamic>> _mergeById(List<Map<String, dynamic>> local, List<Map<String, dynamic>> remote) {
    final localMap = <String, Map<String, dynamic>>{};
    for (final item in local) { final id = item['id'] as String?; if (id != null) localMap[id] = item; }
    final remoteMap = <String, Map<String, dynamic>>{};
    for (final item in remote) { final id = item['id'] as String?; if (id != null) remoteMap[id] = item; }

    final merged = <String, Map<String, dynamic>>{};
    for (final entry in remoteMap.entries) {
      final id = entry.key;
      if (localMap.containsKey(id)) {
        final lt = _parseTime(localMap[id]!['updatedAt']);
        final rt = _parseTime(entry.value['updatedAt']);
        merged[id] = lt.isAfter(rt) ? localMap[id]! : entry.value;
      } else {
        merged[id] = entry.value;
      }
    }
    for (final entry in localMap.entries) {
      if (!remoteMap.containsKey(entry.key)) merged[entry.key] = entry.value;
    }
    return merged.values.toList();
  }

  DateTime _parseTime(dynamic value) {
    if (value == null) return DateTime(2000);
    try { return DateTime.parse(value.toString()); } catch (_) { return DateTime(2000); }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE DRIVE — download/upload finance.json
  // ═══════════════════════════════════════════════════════════════════════════

  /// Fetch the remote finance file content WITHOUT decrypting.
  /// Returns the parsed JSON (an encrypted envelope OR plaintext finance data),
  /// or null if there is no remote file. Used to detect whether Drive holds an
  /// encrypted envelope this client cannot read yet — so sync never clobbers
  /// ciphertext with plaintext.
  Future<Map<String, dynamic>?> _fetchRemoteRaw(GoogleSignInAccount user) async {
    final client = await _getAuthClient(user);
    if (client == null) return null;

    try {
      final driveApi = drive.DriveApi(client);
      final folderId = await _findOrCreateFolder(driveApi);

      String query = "name = '$_financeFileName' and trashed = false";
      if (folderId != null) query += " and '$folderId' in parents";

      final fileList = await driveApi.files.list(
        q: query, orderBy: 'modifiedTime desc', pageSize: 1,
        $fields: 'files(id, name, modifiedTime)',
      );

      final files = fileList.files;
      if (files == null || files.isEmpty) return null;

      final fileId = files.first.id!;
      final media = await driveApi.files.get(fileId, downloadOptions: drive.DownloadOptions.fullMedia) as drive.Media;

      final bytes = <int>[];
      await for (final chunk in media.stream) { bytes.addAll(chunk); }
      final jsonStr = utf8.decode(bytes);
      return jsonDecode(jsonStr) as Map<String, dynamic>;
    } catch (e) {
      debugPrint('[SYNC] Download error: $e');
      return null;
    } finally {
      client.close();
    }
  }

  /// True when Drive holds an encrypted envelope this device cannot decrypt yet
  /// (no PIN key loaded). In that state we must NOT push plaintext over it.
  Future<bool> isRemoteLocked(GoogleSignInAccount user) async {
    final raw = await _fetchRemoteRaw(user);
    return raw != null &&
        CryptoService.instance.isEncryptedEnvelope(raw) &&
        !CryptoService.instance.hasKey();
  }

  /// Download finance.json and, if it is an encrypted envelope, decrypt it.
  /// Returns null if there is no remote file OR if it is encrypted but this
  /// device has no key loaded (locked) — callers guard with [isRemoteLocked].
  Future<Map<String, dynamic>?> _downloadFinanceJson(GoogleSignInAccount user) async {
    final raw = await _fetchRemoteRaw(user);
    if (raw == null) return null;
    final crypto = CryptoService.instance;
    if (crypto.isEncryptedEnvelope(raw)) {
      if (!crypto.hasKey()) return null; // locked
      return await crypto.decryptData(raw);
    }
    return raw;
  }

  Future<bool> _uploadFinanceJson(GoogleSignInAccount user, Map<String, dynamic> data) async {
    final client = await _getAuthClient(user);
    if (client == null) return false;

    try {
      final driveApi = drive.DriveApi(client);
      final folderId = await _findOrCreateFolder(driveApi);
      // Encrypt to an envelope when PIN encryption is enabled; else plaintext.
      final crypto = CryptoService.instance;
      final Map<String, dynamic> payload =
          crypto.hasKey() ? await crypto.encryptData(data) : data;
      final content = utf8.encode(jsonEncode(payload));
      final media = drive.Media(Stream.value(content), content.length);

      // Find existing file
      String query = "name = '$_financeFileName' and trashed = false";
      if (folderId != null) query += " and '$folderId' in parents";
      final fileList = await driveApi.files.list(q: query, pageSize: 1, $fields: 'files(id)');

      if (fileList.files != null && fileList.files!.isNotEmpty) {
        await driveApi.files.update(drive.File(), fileList.files!.first.id!, uploadMedia: media);
      } else {
        final fileMetadata = drive.File()
          ..name = _financeFileName
          ..parents = folderId != null ? [folderId] : null;
        await driveApi.files.create(fileMetadata, uploadMedia: media);
      }
      return true;
    } catch (e) {
      debugPrint('[SYNC] Upload error: $e');
      return false;
    } finally {
      client.close();
    }
  }

  Future<http.Client?> _getAuthClient(GoogleSignInAccount user) async {
    try {
      // Force refresh authentication to get fresh token
      final auth = await user.authentication;
      final token = auth.accessToken;
      if (token == null) {
        debugPrint('[SYNC] Auth: no access token');
        return null;
      }
      debugPrint('[SYNC] Auth: got access token (${token.substring(0, 10)}...)');
      final credentials = AccessCredentials(
        AccessToken('Bearer', token, DateTime.now().add(const Duration(hours: 1)).toUtc()),
        null, ['https://www.googleapis.com/auth/drive'],
      );
      return authenticatedClient(http.Client(), credentials);
    } catch (e) {
      debugPrint('[SYNC] Auth error: $e');
      return null;
    }
  }

  Future<String?> _findOrCreateFolder(drive.DriveApi driveApi) async {
    try {
      final folderList = await driveApi.files.list(
        q: "name = '$_folderName' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        pageSize: 1, $fields: 'files(id)',
      );
      if (folderList.files != null && folderList.files!.isNotEmpty) {
        return folderList.files!.first.id;
      }
      final folder = drive.File()..name = _folderName..mimeType = 'application/vnd.google-apps.folder';
      final created = await driveApi.files.create(folder);
      return created.id;
    } catch (e) {
      debugPrint('[SYNC] Folder error: $e');
      return null;
    }
  }
}
