import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../services/sync_service.dart';
import '../../database/database_helper.dart';

/// Screen for managing data sync between App and EXT via Google Drive.
class SyncScreen extends StatefulWidget {
  const SyncScreen({super.key});

  @override
  State<SyncScreen> createState() => _SyncScreenState();
}

class _SyncScreenState extends State<SyncScreen> {
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['https://www.googleapis.com/auth/drive'],
  );

  bool _isLoading = false;
  bool _isSyncing = false;
  String? _statusMessage;
  String? _statusType; // 'success', 'error', 'info'
  GoogleSignInAccount? _user;

  @override
  void initState() {
    super.initState();
    _checkSignIn();
  }

  Future<void> _checkSignIn() async {
    _user = await _googleSignIn.signInSilently();
    if (mounted) setState(() {});
  }

  Future<void> _signIn() async {
    setState(() => _isLoading = true);
    try {
      _user = await _googleSignIn.signIn();
    } catch (e) {
      _setStatus('Đăng nhập thất bại: $e', 'error');
    }
    if (mounted) setState(() => _isLoading = false);
  }

  Future<void> _signOut() async {
    await _googleSignIn.signOut();
    setState(() {
      _user = null;
      _statusMessage = null;
    });
  }

  /// Phase 1: Full import from EXT (clear + download + import)
  Future<void> _initialImport() async {
    if (_user == null) {
      _setStatus('Vui lòng đăng nhập Google trước', 'error');
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Khởi tạo dữ liệu từ EXT'),
        content: const Text(
          'Thao tác này sẽ:\n\n'
          '1. XÓA toàn bộ dữ liệu hiện tại trên App\n'
          '2. Tải finance.json từ Google Drive\n'
          '3. Import toàn bộ dữ liệu EXT vào App\n\n'
          'Bạn có chắc chắn muốn tiếp tục?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Xác nhận'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() {
      _isSyncing = true;
      _statusMessage = 'Đang tải finance.json từ Google Drive...';
      _statusType = 'info';
    });

    try {
      // Step 1: Download finance.json (with timeout)
      final data = await SyncService.instance.downloadFinanceJson(_user!)
          .timeout(const Duration(seconds: 30), onTimeout: () => null);
      if (data == null) {
        _setStatus('Không tìm thấy finance.json trên Google Drive hoặc timeout.\n'
            'Hãy đảm bảo EXT đã đồng bộ dữ liệu lên Drive.', 'error');
        setState(() => _isSyncing = false);
        return;
      }

      setState(() => _statusMessage = 'Đang import dữ liệu...');

      // Step 2: Import into new DB
      await DatabaseHelper.instance.importFinanceJson(data)
          .timeout(const Duration(seconds: 60));

      // Save sync timestamp
      final lastModified = data['lastModified'] as String? ?? DateTime.now().toIso8601String();
      await SyncService.instance.setLastSyncTimestamp(lastModified);

      final recordCount = (data['records'] as List?)?.length ?? 0;
      _setStatus('Import thành công! $recordCount records', 'success');
    } catch (e) {
      _setStatus('Lỗi: $e', 'error');
    } finally {
      if (mounted) setState(() => _isSyncing = false);
    }
  }

  /// Phase 2: Full 2-way sync
  Future<void> _fullSync() async {
    if (_user == null) {
      _setStatus('Vui lòng đăng nhập Google trước', 'error');
      return;
    }

    setState(() {
      _isSyncing = true;
      _statusMessage = 'Đang đồng bộ 2 chiều...';
      _statusType = 'info';
    });

    try {
      final message = await SyncService.instance.fullSync(_user!)
          .timeout(const Duration(seconds: 60), onTimeout: () => 'Timeout: đồng bộ quá 60 giây');
      final isSuccess = SyncService.instance.status == SyncStatus.success;
      _setStatus(message, isSuccess ? 'success' : 'error');
    } catch (e) {
      _setStatus('Lỗi: $e', 'error');
    } finally {
      if (mounted) setState(() => _isSyncing = false);
    }
  }

  void _setStatus(String message, String type) {
    if (mounted) {
      setState(() {
        _statusMessage = message;
        _statusType = type;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Đồng bộ dữ liệu')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Account card
          _buildAccountCard(),
          const SizedBox(height: 16),

          // Status
          if (_statusMessage != null) _buildStatusCard(),
          if (_statusMessage != null) const SizedBox(height: 16),

          // Actions
          if (_user != null) ...[
            _buildActionCard(
              icon: Icons.download,
              title: 'Khởi tạo từ EXT',
              subtitle: 'Xóa dữ liệu App, import toàn bộ từ finance.json',
              color: Colors.deepPurple,
              onTap: _isSyncing ? null : _initialImport,
            ),
            const SizedBox(height: 12),
            _buildActionCard(
              icon: Icons.sync,
              title: 'Đồng bộ 2 chiều',
              subtitle: 'Merge dữ liệu App ↔ Drive ↔ EXT',
              color: Colors.blue,
              onTap: _isSyncing ? null : _fullSync,
            ),
          ],

          // Import result details removed (new architecture)
          
        ],
      ),
    );
  }

  Widget _buildAccountCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(
              _user != null ? Icons.cloud_done : Icons.cloud_off,
              color: _user != null ? Colors.green : Colors.grey,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _user != null ? 'Đã kết nối' : 'Chưa kết nối',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  if (_user != null)
                    Text(_user!.email,
                        style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
            if (_isLoading)
              const SizedBox(
                width: 24, height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            else
              _user != null
                  ? TextButton(onPressed: _signOut, child: const Text('Đăng xuất'))
                  : FilledButton.icon(
                      onPressed: _signIn,
                      icon: const Icon(Icons.login),
                      label: const Text('Đăng nhập'),
                    ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusCard() {
    Color bgColor;
    IconData icon;
    switch (_statusType) {
      case 'success':
        bgColor = Colors.green.shade50;
        icon = Icons.check_circle;
        break;
      case 'error':
        bgColor = Colors.red.shade50;
        icon = Icons.error;
        break;
      default:
        bgColor = Colors.blue.shade50;
        icon = Icons.info;
    }
    return Card(
      color: bgColor,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 20, color: _statusType == 'success'
                ? Colors.green : _statusType == 'error'
                ? Colors.red : Colors.blue),
            const SizedBox(width: 8),
            Expanded(
              child: _isSyncing
                  ? Row(children: [
                      const SizedBox(width: 16, height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2)),
                      const SizedBox(width: 8),
                      Expanded(child: Text(_statusMessage!)),
                    ])
                  : Text(_statusMessage!),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    VoidCallback? onTap,
  }) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: color.withOpacity(0.1),
          child: Icon(icon, color: color),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle, style: const TextStyle(fontSize: 12)),
        trailing: onTap != null
            ? const Icon(Icons.chevron_right)
            : const Icon(Icons.lock, color: Colors.grey, size: 18),
        onTap: onTap,
      ),
    );
  }

  Widget _buildResultCard() {
    return const SizedBox.shrink();
  }

  Widget _resultRow(String label, int count, {bool bold = false}) {
    return const SizedBox.shrink();
  }
}
