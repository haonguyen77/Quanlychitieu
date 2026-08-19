import 'package:flutter/material.dart';
import '../../database/database_helper.dart';
import '../../utils/formatters.dart';

class ActivityLogScreen extends StatefulWidget {
  const ActivityLogScreen({super.key});

  @override
  State<ActivityLogScreen> createState() => _ActivityLogScreenState();
}

class _ActivityLogScreenState extends State<ActivityLogScreen> {
  List<Map<String, dynamic>> _logs = [];
  bool _isLoading = true;
  String? _filterAction;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final db = await DatabaseHelper.instance.database;
    String where = '1=1';
    List<dynamic> args = [];
    if (_filterAction != null) { where += ' AND action = ?'; args.add(_filterAction); }
    _logs = await db.rawQuery('SELECT * FROM activity_log WHERE $where ORDER BY created_at DESC LIMIT 200', args);
    setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nhật ký hoạt động'),
        actions: [
          PopupMenuButton<String?>(
            icon: const Icon(Icons.filter_list),
            tooltip: 'Lọc theo hành động',
            onSelected: (v) { setState(() { _filterAction = v; _isLoading = true; }); _load(); },
            itemBuilder: (_) => [
              const PopupMenuItem(value: null, child: Text('Tất cả')),
              const PopupMenuItem(value: 'create', child: Text('Tạo mới')),
              const PopupMenuItem(value: 'update', child: Text('Cập nhật')),
              const PopupMenuItem(value: 'delete', child: Text('Xóa')),
              const PopupMenuItem(value: 'restore', child: Text('Khôi phục')),
            ],
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _logs.isEmpty
              ? Center(child: Text('Chưa có hoạt động nào',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.outline)))
              : ListView.builder(
                  padding: const EdgeInsets.all(8),
                  itemCount: _logs.length,
                  itemBuilder: (ctx, i) => _buildLogItem(_logs[i]),
                ),
    );
  }

  Widget _buildLogItem(Map<String, dynamic> log) {
    final action = log['action'] as String? ?? '';
    final entityType = log['entity_type'] as String? ?? '';
    final createdAt = log['created_at'] != null ? DateTime.tryParse(log['created_at'] as String) : null;

    IconData icon;
    Color color;
    switch (action) {
      case 'create': icon = Icons.add_circle_outline; color = Colors.green; break;
      case 'update': icon = Icons.edit_outlined; color = Colors.blue; break;
      case 'delete': icon = Icons.delete_outline; color = Colors.red; break;
      case 'restore': icon = Icons.restore; color = Colors.orange; break;
      default: icon = Icons.info_outline; color = Colors.grey;
    }

    final actionLabel = switch (action) {
      'create' => 'Tạo mới',
      'update' => 'Cập nhật',
      'delete' => 'Xóa',
      'restore' => 'Khôi phục',
      _ => action,
    };

    final entityLabel = switch (entityType) {
      'transaction' => 'giao dịch',
      'category' => 'danh mục',
      'account' => 'tài khoản',
      'module' => 'module',
      'budget' => 'ngân sách',
      _ => entityType,
    };

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 2, horizontal: 4),
      child: ListTile(
        dense: true,
        leading: CircleAvatar(
          radius: 16,
          backgroundColor: color.withValues(alpha: 0.1),
          child: Icon(icon, size: 18, color: color),
        ),
        title: Text('$actionLabel $entityLabel', style: Theme.of(context).textTheme.bodyMedium),
        subtitle: Text(createdAt != null ? Formatters.dateTime(createdAt) : '',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.outline)),
        trailing: Text(createdAt != null ? _timeAgo(createdAt) : '',
            style: Theme.of(context).textTheme.bodySmall),
      ),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) return '${diff.inMinutes} phút trước';
    if (diff.inHours < 24) return '${diff.inHours} giờ trước';
    if (diff.inDays < 30) return '${diff.inDays} ngày trước';
    return '${(diff.inDays / 30).round()} tháng trước';
  }
}
