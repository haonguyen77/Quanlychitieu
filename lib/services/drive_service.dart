import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:googleapis/drive/v3.dart' as drive;
import 'package:googleapis_auth/googleapis_auth.dart';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import '../database/database_helper.dart';

class DriveService {
  DriveService._();
  static final DriveService instance = DriveService._();

  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['https://www.googleapis.com/auth/drive'],
  );

  GoogleSignInAccount? _currentUser;
  GoogleSignInAccount? get currentUser => _currentUser;
  bool get isSignedIn => _currentUser != null;

  Future<bool> signIn() async {
    try {
      _currentUser = await _googleSignIn.signIn();
      return _currentUser != null;
    } catch (e) {
      debugPrint('DriveService: Sign in failed: $e');
      return false;
    }
  }

  Future<void> signOut() async {
    await _googleSignIn.signOut();
    _currentUser = null;
  }

  Future<http.Client?> _getAuthClient() async {
    if (_currentUser == null) {
      final success = await signIn();
      if (!success) return null;
    }
    final auth = await _currentUser!.authentication;
    final credentials = AccessCredentials(
      AccessToken(
        'Bearer',
        auth.accessToken!,
        DateTime.now().add(const Duration(hours: 1)).toUtc(),
      ),
      null,
      ['https://www.googleapis.com/auth/drive.file'],
    );
    return authenticatedClient(http.Client(), credentials);
  }

  Future<String?> uploadBackup() async {
    final client = await _getAuthClient();
    if (client == null) return null;

    try {
      final driveApi = drive.DriveApi(client);

      // Close DB before backup
      await DatabaseHelper.instance.closeDB();

      final dbPath = await DatabaseHelper.instance.getDatabasePath();
      final dbFile = File(dbPath);

      if (!await dbFile.exists()) {
        // Reopen DB
        await DatabaseHelper.instance.database;
        return null;
      }

      final timestamp = DateTime.now()
          .toIso8601String()
          .replaceAll(':', '-')
          .substring(0, 19);
      final fileName = 'QLCT_backup_$timestamp.db';

      final uploadFile = drive.File()..name = fileName;

      final media = drive.Media(dbFile.openRead(), await dbFile.length());
      final result = await driveApi.files.create(
        uploadFile,
        uploadMedia: media,
      );

      // Reopen DB
      await DatabaseHelper.instance.database;

      return result.id;
    } catch (e) {
      debugPrint('DriveService: Upload failed: $e');
      // Ensure DB is reopened
      await DatabaseHelper.instance.database;
      return null;
    } finally {
      client.close();
    }
  }

  Future<List<drive.File>> listBackups() async {
    final client = await _getAuthClient();
    if (client == null) return [];

    try {
      final driveApi = drive.DriveApi(client);
      final result = await driveApi.files.list(
        q: "name contains 'QLCT_backup_' and trashed = false",
        orderBy: 'createdTime desc',
        pageSize: 20,
        $fields: 'files(id, name, createdTime, size)',
      );
      return result.files ?? [];
    } catch (e) {
      debugPrint('DriveService: List backups failed: $e');
      return [];
    } finally {
      client.close();
    }
  }

  Future<bool> restoreBackup(String fileId) async {
    final client = await _getAuthClient();
    if (client == null) return false;

    try {
      final driveApi = drive.DriveApi(client);

      // Download file
      final media = await driveApi.files.get(
        fileId,
        downloadOptions: drive.DownloadOptions.fullMedia,
      ) as drive.Media;

      // Save to temp file
      final tempDir = await getTemporaryDirectory();
      final tempFile = File(p.join(tempDir.path, 'restore_temp.db'));
      final sink = tempFile.openWrite();
      await media.stream.pipe(sink);
      await sink.close();

      // Close current DB
      await DatabaseHelper.instance.closeDB();

      // Replace DB file
      final dbPath = await DatabaseHelper.instance.getDatabasePath();
      await tempFile.copy(dbPath);
      await tempFile.delete();

      // Reopen DB
      await DatabaseHelper.instance.database;

      return true;
    } catch (e) {
      debugPrint('DriveService: Restore failed: $e');
      // Try to reopen DB
      await DatabaseHelper.instance.database;
      return false;
    } finally {
      client.close();
    }
  }
}
