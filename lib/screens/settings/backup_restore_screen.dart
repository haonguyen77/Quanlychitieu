import 'dart:io';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';
import 'package:intl/intl.dart';
import '../../database/database_helper.dart';
import '../../app/constants.dart';

class BackupRestoreScreen extends StatefulWidget {
  const BackupRestoreScreen({super.key});

  @override
  State<BackupRestoreScreen> createState() => _BackupRestoreScreenState();
}

class _BackupRestoreScreenState extends State<BackupRestoreScreen> {
  bool _isLoading = false;
  String? _lastBackupPath;
  List<FileSystemEntity> _backupFiles = [];

  @override
  void initState() {
    super.initState();
    _loadBackupFiles();
  }

  Future<String> _getBackupDirPath() async {
    final extDir = await getExternalStorageDirectory();
    if (extDir != null) {
      return p.join(extDir.path, 'QuanLyChiTieu_Backup');
    }
    final appDir = await getApplicationDocumentsDirectory();
    return p.join(appDir.path, 'QuanLyChiTieu_Backup');
  }

  Future<void> _loadBackupFiles() async {
    try {
      final dirPath = await _getBackupDirPath();
      final dir = Directory(dirPath);
      if (await dir.exists()) {
        final files = dir.listSync()
            .where((f) => f.path.endsWith('.db'))
            .toList()
          ..sort((a, b) => b.statSync().modified.compareTo(a.statSync().modified));
        setState(() => _backupFiles = files);
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sao lưu & Khôi phục')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Export section
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Icon(Icons.backup, color: Theme.of(context).colorScheme.primary),
                      const SizedBox(width: 8),
                      Text('Sao lưu (Export)', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                    ]),
                    const SizedBox(height: 8),
                    Text('Xuất toàn bộ dữ liệu ra file backup. Lưu file này trước khi gỡ ứng dụng.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.outline)),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: _isLoading ? null : _exportBackup,
                        icon: _isLoading
                            ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.file_download),
                        label: const Text('Xuất file backup'),
                      ),
                    ),
                    if (_lastBackupPath != null) ...[
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.green.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(children: [
                          const Icon(Icons.check_circle, color: Colors.green, size: 16),
                          const SizedBox(width: 8),
                          Expanded(child: Text('Đã lưu: $_lastBackupPath',
                              style: Theme.of(context).textTheme.bodySmall)),
                        ]),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Import section
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Icon(Icons.restore, color: Theme.of(context).colorScheme.secondary),
                      const SizedBox(width: 8),
                      Text('Khôi phục (Import)', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                    ]),
                    const SizedBox(height: 8),
                    Text('Khôi phục dữ liệu từ file backup. Dữ liệu hiện tại sẽ bị thay thế.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.outline)),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _isLoading ? null : _importBackup,
                        icon: const Icon(Icons.file_upload),
                        label: const Text('Chọn file backup để khôi phục'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Available backups
            if (_backupFiles.isNotEmpty) ...[
              Text('File backup gần đây',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              for (final file in _backupFiles.take(10))
                Card(
                  margin: const EdgeInsets.only(bottom: 4),
                  child: ListTile(
                    dense: true,
                    leading: const Icon(Icons.insert_drive_file, size: 20),
                    title: Text(p.basename(file.path), style: const TextStyle(fontSize: 13)),
                    subtitle: Text(_formatFileDate(file),
                        style: Theme.of(context).textTheme.bodySmall),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextButton(
                          onPressed: () => _restoreFromFile(file.path),
                          child: const Text('Khôi phục'),
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red),
                          onPressed: () async {
                            final confirm = await showDialog<bool>(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('Xóa backup'),
                                content: Text('Xóa file ${p.basename(file.path)}?'),
                                actions: [
                                  TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
                                  FilledButton(onPressed: () => Navigator.pop(ctx, true),
                                      style: FilledButton.styleFrom(backgroundColor: Colors.red),
                                      child: const Text('Xóa')),
                                ],
                              ),
                            );
                            if (confirm == true) {
                              await File(file.path).delete();
                              _loadBackupFiles();
                            }
                          },
                        ),
                      ],
                    ),
                  ),
                ),
            ],

            const SizedBox(height: 16),
            // Info
            Card(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Icon(Icons.info_outline, size: 16, color: Theme.of(context).colorScheme.outline),
                      const SizedBox(width: 8),
                      Text('Hướng dẫn', style: Theme.of(context).textTheme.titleSmall),
                    ]),
                    const SizedBox(height: 8),
                    Text('1. Trước khi gỡ app: nhấn "Xuất file backup"\n'
                        '2. File được lưu trong thư mục ứng dụng\n'
                        '3. Chia sẻ file backup ra ngoài (Google Drive, Zalo...)\n'
                        '4. Sau khi cài lại: copy file backup vào → "Khôi phục"',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.outline)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _exportBackup() async {
    setState(() => _isLoading = true);

    try {
      // Get current DB path
      final dbPath = await getDatabasesPath();
      final sourcePath = p.join(dbPath, AppConstants.dbName);
      final sourceFile = File(sourcePath);

      if (!await sourceFile.exists()) {
        _showError('Không tìm thấy file database');
        return;
      }

      // Create backup directory
      final backupDirPath = await _getBackupDirPath();
      final backupDir = Directory(backupDirPath);
      if (!await backupDir.exists()) {
        await backupDir.create(recursive: true);
      }

      // Create backup with timestamp
      final timestamp = DateFormat('yyyyMMdd_HHmmss').format(DateTime.now());
      final backupPath = p.join(backupDir.path, 'backup_$timestamp.db');

      // Close DB, encrypt and save
      await DatabaseHelper.instance.closeDB();
      final rawBytes = await sourceFile.readAsBytes();
      final encryptedBytes = _encryptBytes(rawBytes);
      await File(backupPath).writeAsBytes(encryptedBytes);
      await DatabaseHelper.instance.database; // reopen

      setState(() => _lastBackupPath = backupPath);
      await _loadBackupFiles();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Đã xuất backup thành công!\nLưu tại: $backupPath'),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 4),
        ));
      }
    } catch (e) {
      _showError('Lỗi xuất backup: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _importBackup() async {
    // Show file picker from backup directory
    final backupDirPath = await _getBackupDirPath();
    final backupDir = Directory(backupDirPath);
    if (!await backupDir.exists()) {
      _showError('Không tìm thấy thư mục backup.\nXuất backup trước khi khôi phục.');
      return;
    }

    final files = backupDir.listSync()
        .where((f) => f.path.endsWith('.db'))
        .toList()
      ..sort((a, b) => b.statSync().modified.compareTo(a.statSync().modified));

    if (files.isEmpty) {
      _showError('Không có file backup nào trong thư mục.');
      return;
    }

    // Use the most recent backup
    if (mounted) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Khôi phục dữ liệu'),
          content: Text('Khôi phục từ file mới nhất:\n${p.basename(files.first.path)}\n\nDữ liệu hiện tại sẽ bị thay thế hoàn toàn. Tiếp tục?'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Khôi phục')),
          ],
        ),
      );

      if (confirmed == true) {
        await _restoreFromFile(files.first.path);
      }
    }
  }

  Future<void> _restoreFromFile(String backupPath) async {
    setState(() => _isLoading = true);

    try {
      final backupFile = File(backupPath);
      if (!await backupFile.exists()) {
        _showError('File backup không tồn tại');
        return;
      }

      // Get target DB path
      final dbPath = await getDatabasesPath();
      final targetPath = p.join(dbPath, AppConstants.dbName);

      // Close current DB
      await DatabaseHelper.instance.closeDB();

      // Decrypt and replace DB file
      final encryptedBytes = await backupFile.readAsBytes();
      final decryptedBytes = _decryptBytes(encryptedBytes);
      await File(targetPath).writeAsBytes(decryptedBytes);

      // Reopen DB
      await DatabaseHelper.instance.database;

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Khôi phục thành công! Khởi động lại ứng dụng để áp dụng.'),
          behavior: SnackBarBehavior.floating,
          duration: Duration(seconds: 4),
        ));
      }
    } catch (e) {
      _showError('Lỗi khôi phục: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _showError(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(message),
        backgroundColor: Theme.of(context).colorScheme.error,
        behavior: SnackBarBehavior.floating,
      ));
    }
    setState(() => _isLoading = false);
  }

  String _formatFileDate(FileSystemEntity file) {
    final stat = file.statSync();
    return DateFormat('dd/MM/yyyy HH:mm').format(stat.modified);
  }

  // Simple XOR encryption with app key
  static const _encryptionKey = 'QuanLyChiTieu_HaoNguyen_2026_SecureBackup';

  Uint8List _encryptBytes(Uint8List data) {
    final key = utf8.encode(_encryptionKey);
    final result = Uint8List(data.length);
    for (int i = 0; i < data.length; i++) {
      result[i] = data[i] ^ key[i % key.length];
    }
    return result;
  }

  Uint8List _decryptBytes(Uint8List data) {
    // XOR is symmetric - same operation for encrypt/decrypt
    return _encryptBytes(data);
  }
}
