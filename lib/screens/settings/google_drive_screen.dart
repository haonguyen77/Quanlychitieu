import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:googleapis/drive/v3.dart' as drive;
import '../../services/sync_service.dart';
import '../../services/drive_service.dart';
import '../../services/crypto_service.dart';
import '../../database/database_helper.dart';

/// Google Drive screen with both SYNC (2-way merge) and BACKUP (full DB file).
class GoogleDriveScreen extends StatefulWidget {
  const GoogleDriveScreen({super.key});

  @override
  State<GoogleDriveScreen> createState() => _GoogleDriveScreenState();
}

class _GoogleDriveScreenState extends State<GoogleDriveScreen> {
  static const _green = Color(0xFF2E7D32);
  static const _blue = Color(0xFF1565C0);

  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['https://www.googleapis.com/auth/drive'],
  );

  GoogleSignInAccount? _user;
  bool _isLoading = false;
  bool _isSyncing = false;
  bool _isBackingUp = false;
  bool _isRestoring = false;
  String? _lastSyncTime;
  String? _syncResult;
  String? _syncResultType; // 'success', 'error', 'info'
  List<drive.File> _backups = [];
  bool _encEnabled = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    _user = await _googleSignIn.signInSilently();
    _lastSyncTime = await SyncService.instance.getLastSyncTimestamp();
    _encEnabled = await CryptoService.instance.isEnabled();
    if (_user != null && DriveService.instance.isSignedIn) {
      _loadBackups();
    }
    if (mounted) setState(() {});
  }

  Future<void> _signIn() async {
    setState(() => _isLoading = true);
    try {
      _user = await _googleSignIn.signIn();
      if (_user != null) {
        await DriveService.instance.signIn();
        await _loadBackups();
      }
    } catch (e) {
      _setResult('Đăng nhập thất bại: $e', 'error');
    }
    if (mounted) setState(() => _isLoading = false);
  }

  Future<void> _signOut() async {
    await _googleSignIn.signOut();
    await DriveService.instance.signOut();
    setState(() {
      _user = null;
      _backups = [];
      _syncResult = null;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC (2-way merge via SyncService)
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> _fullSync() async {
    if (_user == null) {
      _setResult('Vui lòng đăng nhập Google trước', 'error');
      return;
    }

    // Ensure the encryption key is available (prompt for PIN if needed) before
    // syncing, so we can decrypt the Drive envelope and never clobber it.
    final unlocked = await _ensureUnlocked();
    if (!unlocked) return;

    setState(() {
      _isSyncing = true;
      _syncResult = null;
    });

    try {
      final message = await SyncService.instance.fullSync(_user!)
          .timeout(const Duration(seconds: 60), onTimeout: () => 'Timeout: đồng bộ quá 60 giây');

      final isSuccess = SyncService.instance.status == SyncStatus.success;
      _lastSyncTime = await SyncService.instance.getLastSyncTimestamp();
      _setResult(message, isSuccess ? 'success' : 'error');
    } catch (e) {
      _setResult('Lỗi: $e', 'error');
    } finally {
      if (mounted) setState(() => _isSyncing = false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENCRYPTION (PIN — cross-client E2E, same PIN as WebApp/Extension)
  // ═══════════════════════════════════════════════════════════════════════════

  /// Ensure the encryption key is loaded before syncing.
  /// Returns false only when a required PIN prompt is cancelled or fails.
  Future<bool> _ensureUnlocked() async {
    final crypto = CryptoService.instance;
    if (crypto.hasKey()) return true;

    // This device already has encryption enabled → verify PIN to load the key.
    if (await crypto.isEnabled()) {
      final pin = await _promptPin('Nhập mã PIN', 'Nhập mã PIN mã hóa để đồng bộ dữ liệu.');
      if (pin == null) return false;

      // 1) Verify against the LOCAL token first — offline & deterministic, so a
      //    transient network/token error can never be mistaken for a wrong PIN.
      if (await crypto.verifyPin(pin)) {
        if (mounted) setState(() => _encEnabled = true);
        return true;
      }

      // 2) Local token failed (e.g. PIN changed on another device). Try the
      //    remote envelope as the authoritative source and refresh the token.
      if (_user != null) {
        final raw = await SyncService.instance.fetchRemoteRaw(_user!);
        if (raw != null && crypto.isEncryptedEnvelope(raw)) {
          final data = await crypto.establishFromEnvelope(pin, raw);
          if (data != null) {
            if (mounted) setState(() => _encEnabled = true);
            return true;
          }
        }
      }
      _setResult('Mã PIN không đúng', 'error');
      return false;
    }

    // Fresh device → Drive may hold an encrypted envelope. Establish key from it.
    if (_user != null) {
      final raw = await SyncService.instance.fetchRemoteRaw(_user!);
      if (raw != null && crypto.isEncryptedEnvelope(raw)) {
        final pin = await _promptPin('Nhập mã PIN', 'Dữ liệu Google Drive đã được mã hóa. Nhập mã PIN để mở khóa.');
        if (pin == null) return false;
        final data = await crypto.establishFromEnvelope(pin, raw);
        if (data == null) { _setResult('Mã PIN không đúng', 'error'); return false; }
        if (mounted) setState(() => _encEnabled = true);
        return true;
      }
    }
    return true; // no encryption in play
  }

  Future<void> _enableEncryption() async {
    final pin = await _promptPin('Đặt mã PIN', 'Đặt mã PIN 4-6 số. Cùng mã PIN này sẽ mở khóa dữ liệu trên WebApp và Extension.');
    if (pin == null) return;
    if (pin.length < 4) { _setResult('PIN tối thiểu 4 số', 'error'); return; }
    final pin2 = await _promptPin('Xác nhận mã PIN', 'Nhập lại mã PIN để xác nhận.');
    if (pin2 == null) return;
    if (pin != pin2) { _setResult('PIN nhập lại không khớp', 'error'); return; }
    await CryptoService.instance.setupPin(pin);
    if (mounted) setState(() => _encEnabled = true);
    _setResult('Đã bật mã hóa. Nhấn "Đồng bộ ngay" để tải dữ liệu đã mã hóa lên Google Drive.', 'success');
  }

  Future<void> _changeEncryptionPin() async {
    final oldPin = await _promptPin('Mã PIN hiện tại', 'Nhập mã PIN hiện tại.');
    if (oldPin == null) return;
    final newPin = await _promptPin('Mã PIN mới', 'Nhập mã PIN mới (4-6 số).');
    if (newPin == null) return;
    if (newPin.length < 4) { _setResult('PIN mới tối thiểu 4 số', 'error'); return; }
    final confirm = await _promptPin('Xác nhận mã PIN mới', 'Nhập lại mã PIN mới.');
    if (confirm == null) return;
    if (newPin != confirm) { _setResult('PIN nhập lại không khớp', 'error'); return; }
    final ok = await CryptoService.instance.changePin(oldPin, newPin);
    if (!ok) { _setResult('Mã PIN hiện tại không đúng', 'error'); return; }
    _setResult('Đã đổi mã PIN. Nhấn "Đồng bộ ngay" để cập nhật dữ liệu trên Drive.', 'success');
  }

  Future<void> _disableEncryption() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('⚠️ Reset PIN'),
        content: const Text('Thao tác này sẽ XÓA TOÀN BỘ DỮ LIỆU mã hóa trên thiết bị này và trên Google Drive.\n\nSau khi reset, bạn sẽ tạo PIN mới và bắt đầu lại từ đầu.\n\nBạn có chắc chắn muốn tiếp tục?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Reset PIN'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await CryptoService.instance.disable();
    // Clear local DB encrypted data and upload empty to Drive
    try {
      final db = await DatabaseHelper.instance.database;
      await db.delete('sync_records');
      await db.delete('records');
    } catch (_) {}
    if (_user != null) {
      try {
        await SyncService.instance.fullSync(_user!);
      } catch (_) {}
    }
    if (mounted) setState(() => _encEnabled = false);
    _setResult('Đã reset PIN. Vui lòng thiết lập PIN mới.', 'success');
  }

  Future<String?> _promptPin(String title, String subtitle) async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(subtitle, style: const TextStyle(fontSize: 13)),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              autofocus: true,
              obscureText: true,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: const InputDecoration(hintText: 'Mã PIN (4-6 số)', counterText: ''),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          FilledButton(onPressed: () => Navigator.pop(ctx, controller.text.trim()), child: const Text('Xác nhận')),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BACKUP (full DB file via DriveService)
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> _loadBackups() async {
    if (!DriveService.instance.isSignedIn) return;
    setState(() => _isLoading = true);
    final backups = await DriveService.instance.listBackups();
    if (mounted) setState(() { _backups = backups; _isLoading = false; });
  }

  Future<void> _uploadBackup() async {
    setState(() { _isBackingUp = true; _syncResult = null; });
    final fileId = await DriveService.instance.uploadBackup();
    if (mounted) {
      setState(() => _isBackingUp = false);
      _setResult(
        fileId != null ? 'Sao lưu thành công!' : 'Sao lưu thất bại. Vui lòng thử lại.',
        fileId != null ? 'success' : 'error',
      );
      if (fileId != null) await _loadBackups();
    }
  }

  Future<void> _restoreBackup(drive.File file) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xác nhận khôi phục'),
        content: Text('Khôi phục dữ liệu từ "${file.name}"?\n\nDữ liệu hiện tại sẽ bị thay thế hoàn toàn.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.orange),
            child: const Text('Khôi phục'),
          ),
        ],
      ),
    );
    if (confirmed != true || file.id == null) return;

    setState(() { _isRestoring = true; _syncResult = null; });
    final success = await DriveService.instance.restoreBackup(file.id!);
    if (mounted) {
      setState(() => _isRestoring = false);
      _setResult(
        success ? 'Khôi phục thành công! Vui lòng khởi động lại ứng dụng.' : 'Khôi phục thất bại.',
        success ? 'success' : 'error',
      );
    }
  }

  void _setResult(String message, String type) {
    if (mounted) setState(() { _syncResult = message; _syncResultType = type; });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    final isSignedIn = _user != null;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text('Google Drive', style: TextStyle(color: Color(0xFF1A1A1A), fontSize: 18, fontWeight: FontWeight.w600)),
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: Color(0xFF1A1A1A)), onPressed: () => Navigator.pop(context)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ─── Account Status ──────────────────────────────────────────────
          _buildAccountCard(isSignedIn),
          const SizedBox(height: 16),

          // ─── Status Message ──────────────────────────────────────────────
          if (_syncResult != null) ...[
            _buildResultCard(),
            const SizedBox(height: 16),
          ],

          if (isSignedIn) ...[
            // ─── SECTION 1: ĐỒNG BỘ DỮ LIỆU ────────────────────────────────
            _buildSectionHeader('ĐỒNG BỘ DỮ LIỆU'),
            const SizedBox(height: 8),
            _buildSyncCard(),
            const SizedBox(height: 20),

            // ─── SECTION: MÃ HÓA ────────────────────────────────────────────
            _buildSectionHeader('BẢO MẬT & MÃ HÓA'),
            const SizedBox(height: 8),
            _buildEncryptionCard(),
            const SizedBox(height: 20),

            // ─── SECTION 2: SAO LƯU ─────────────────────────────────────────
            _buildSectionHeader('SAO LƯU & KHÔI PHỤC'),
            const SizedBox(height: 8),
            _buildBackupCard(),
            const SizedBox(height: 12),
            _buildBackupList(),
          ],
        ],
      ),
    );
  }

  // ─── Account Card ────────────────────────────────────────────────────────

  Widget _buildAccountCard(bool isSignedIn) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Row(
        children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
              color: isSignedIn ? _green.withOpacity(0.1) : Colors.grey[100],
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              isSignedIn ? Icons.cloud_done_rounded : Icons.cloud_off_rounded,
              color: isSignedIn ? _green : Colors.grey[400],
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Container(
                    width: 8, height: 8,
                    decoration: BoxDecoration(shape: BoxShape.circle, color: isSignedIn ? _green : Colors.grey),
                  ),
                  const SizedBox(width: 6),
                  Text(isSignedIn ? 'Đã kết nối' : 'Chưa kết nối', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isSignedIn ? _green : Colors.grey[600])),
                ]),
                if (isSignedIn && _user != null) ...[
                  const SizedBox(height: 2),
                  Text(_user!.email, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                ],
                if (_lastSyncTime != null) ...[
                  const SizedBox(height: 2),
                  Text('Đồng bộ lần cuối: ${_formatTimestamp(_lastSyncTime!)}', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                ],
              ],
            ),
          ),
          if (_isLoading)
            const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
          else
            isSignedIn
                ? TextButton(onPressed: _signOut, child: Text('Ngắt kết nối', style: TextStyle(fontSize: 12, color: Colors.red[400])))
                : FilledButton(
                    onPressed: _signIn,
                    style: FilledButton.styleFrom(backgroundColor: _blue, padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8)),
                    child: const Text('Kết nối', style: TextStyle(fontSize: 13)),
                  ),
        ],
      ),
    );
  }

  // ─── Sync Card ───────────────────────────────────────────────────────────

  Widget _buildSyncCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.sync_rounded, size: 18, color: _blue),
            const SizedBox(width: 8),
            const Text('Đồng bộ dữ liệu 2 chiều', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          ]),
          const SizedBox(height: 6),
          Text(
            'Merge dữ liệu App ↔ Google Drive ↔ EXT theo UUID.\nKhông xóa dữ liệu local.',
            style: TextStyle(fontSize: 12, color: Colors.grey[600]),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _isSyncing ? null : _fullSync,
              icon: _isSyncing
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.sync, size: 18),
              label: Text(_isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'),
              style: FilledButton.styleFrom(
                backgroundColor: _green,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Encryption Card ───────────────────────────────────────────────────────

  Widget _buildEncryptionCard() {
    final color = _encEnabled ? _green : const Color(0xFF6C2BD9);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(_encEnabled ? Icons.verified_user_rounded : Icons.lock_outline_rounded, size: 18, color: color),
            const SizedBox(width: 8),
            Text(_encEnabled ? 'Mã hóa đang BẬT' : 'Mã hóa đang TẮT',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          ]),
          const SizedBox(height: 6),
          Text(
            _encEnabled
                ? 'Dữ liệu trên Google Drive được mã hóa AES-256. Cùng mã PIN mở khóa trên WebApp và Extension.'
                : 'Bật mã hóa để dữ liệu trên Google Drive được mã hóa AES-256 (PBKDF2 310k). Nếu quên PIN sẽ không khôi phục được dữ liệu đã mã hóa.',
            style: TextStyle(fontSize: 12, color: Colors.grey[600], height: 1.4),
          ),
          const SizedBox(height: 14),
          if (!_encEnabled)
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _enableEncryption,
                icon: const Icon(Icons.lock, size: 18),
                label: const Text('Đặt mã PIN & bật mã hóa'),
                style: FilledButton.styleFrom(
                  backgroundColor: color,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            )
          else
            Row(children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _changeEncryptionPin,
                  style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                  child: const Text('Đổi mã PIN', style: TextStyle(fontSize: 13)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton(
                  onPressed: _disableEncryption,
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    side: BorderSide(color: Colors.red[200]!),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: Text('Reset PIN', style: TextStyle(fontSize: 13, color: Colors.red[400])),
                ),
              ),
            ]),
        ],
      ),
    );
  }

  // ─── Backup Card ─────────────────────────────────────────────────────────

  Widget _buildBackupCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.backup_rounded, size: 18, color: Colors.orange[700]),
            const SizedBox(width: 8),
            const Text('Sao lưu toàn bộ database', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          ]),
          const SizedBox(height: 6),
          Text('Tạo bản backup đầy đủ lên Google Drive. Dùng để khôi phục khi cần.', style: TextStyle(fontSize: 12, color: Colors.grey[600])),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: (_isBackingUp || _isRestoring) ? null : _uploadBackup,
              icon: _isBackingUp
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.cloud_upload, size: 18),
              label: Text(_isBackingUp ? 'Đang sao lưu...' : 'Sao lưu ngay'),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Backup List ─────────────────────────────────────────────────────────

  Widget _buildBackupList() {
    if (_isLoading) {
      return const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator()));
    }
    if (_backups.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
        child: Column(children: [
          Icon(Icons.cloud_off, size: 36, color: Colors.grey[300]),
          const SizedBox(height: 8),
          Text('Chưa có bản sao lưu', style: TextStyle(fontSize: 13, color: Colors.grey[500])),
        ]),
      );
    }

    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 12, 4),
            child: Row(children: [
              Text('Danh sách backup (${_backups.length})', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              const Spacer(),
              IconButton(icon: const Icon(Icons.refresh, size: 18), onPressed: _loadBackups, tooltip: 'Làm mới'),
            ]),
          ),
          ...List.generate(_backups.length, (i) {
            final file = _backups[i];
            return ListTile(
              dense: true,
              leading: Icon(Icons.description_outlined, size: 20, color: Colors.grey[600]),
              title: Text(file.name ?? '', style: const TextStyle(fontSize: 12)),
              subtitle: Text(
                '${_formatDriveDate(file.createdTime)} • ${_formatFileSize(file.size)}',
                style: TextStyle(fontSize: 11, color: Colors.grey[500]),
              ),
              trailing: IconButton(
                icon: Icon(Icons.restore, size: 20, color: Colors.orange[700]),
                onPressed: _isRestoring ? null : () => _restoreBackup(file),
                tooltip: 'Khôi phục',
              ),
            );
          }),
        ],
      ),
    );
  }

  // ─── Result Card ─────────────────────────────────────────────────────────

  Widget _buildResultCard() {
    Color bgColor;
    Color iconColor;
    IconData icon;
    switch (_syncResultType) {
      case 'success':
        bgColor = const Color(0xFFE8F5E9);
        iconColor = _green;
        icon = Icons.check_circle_rounded;
        break;
      case 'error':
        bgColor = const Color(0xFFFFEBEE);
        iconColor = Colors.red;
        icon = Icons.error_rounded;
        break;
      default:
        bgColor = const Color(0xFFE3F2FD);
        iconColor = _blue;
        icon = Icons.info_rounded;
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: iconColor),
          const SizedBox(width: 10),
          Expanded(child: Text(_syncResult!, style: TextStyle(fontSize: 13, color: iconColor, height: 1.4))),
        ],
      ),
    );
  }

  // ─── Section Header ──────────────────────────────────────────────────────

  Widget _buildSectionHeader(String title) {
    return Text(title, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _green, letterSpacing: 0.5));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  String _formatTimestamp(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year} '
          '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }

  String _formatDriveDate(DateTime? date) {
    if (date == null) return '';
    final d = date.toLocal();
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year} '
        '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }

  String _formatFileSize(String? sizeStr) {
    if (sizeStr == null) return '';
    final size = int.tryParse(sizeStr) ?? 0;
    if (size < 1024) return '$size B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)} KB';
    return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}
