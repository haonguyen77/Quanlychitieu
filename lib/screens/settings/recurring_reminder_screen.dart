import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../services/notification_service.dart';

/// Manages recurring reminders (e.g., "ngày 10 hàng tháng — tiền nước")
/// Stored in SharedPreferences — does NOT affect DB or sync.
class RecurringReminderScreen extends StatefulWidget {
  const RecurringReminderScreen({super.key});

  @override
  State<RecurringReminderScreen> createState() => _RecurringReminderScreenState();
}

class _RecurringReminderScreenState extends State<RecurringReminderScreen> {
  static const _prefsKey = 'recurring_reminders';
  List<RecurringReminder> _reminders = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final json = prefs.getString(_prefsKey);
    if (json != null) {
      try {
        final list = jsonDecode(json) as List<dynamic>;
        _reminders = list.map((e) => RecurringReminder.fromMap(e as Map<String, dynamic>)).toList();
      } catch (_) {}
    }
    setState(() => _loading = false);
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, jsonEncode(_reminders.map((r) => r.toMap()).toList()));
    // Reschedule all
    await NotificationService.instance.scheduleRecurringReminders(_reminders);
  }

  void _addReminder() async {
    final result = await showDialog<RecurringReminder>(
      context: context,
      builder: (_) => const _AddReminderDialog(),
    );
    if (result != null) {
      setState(() => _reminders.add(result));
      await _save();
    }
  }

  void _deleteReminder(int index) async {
    setState(() => _reminders.removeAt(index));
    await _save();
  }

  void _toggleReminder(int index) async {
    setState(() => _reminders[index] = _reminders[index].copyWith(enabled: !_reminders[index].enabled));
    await _save();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nhắc nhở định kỳ')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _reminders.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.notifications_none, size: 48, color: Colors.grey[400]),
                      const SizedBox(height: 12),
                      Text('Chưa có nhắc nhở định kỳ', style: TextStyle(color: Colors.grey[600])),
                      const SizedBox(height: 8),
                      Text('Ví dụ: Ngày 10 hàng tháng — Đóng tiền nước', style: TextStyle(color: Colors.grey[400], fontSize: 12)),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: _reminders.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final r = _reminders[index];
                    return Card(
                      child: ListTile(
                        leading: Icon(
                          r.enabled ? Icons.alarm_on : Icons.alarm_off,
                          color: r.enabled ? Colors.green : Colors.grey,
                        ),
                        title: Text(r.title, style: const TextStyle(fontWeight: FontWeight.w500)),
                        subtitle: Text(_frequencyText(r)),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Switch(
                              value: r.enabled,
                              onChanged: (_) => _toggleReminder(index),
                              activeColor: Colors.green,
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, size: 20),
                              onPressed: () => _deleteReminder(index),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addReminder,
        icon: const Icon(Icons.add),
        label: const Text('Thêm nhắc nhở'),
      ),
    );
  }

  String _frequencyText(RecurringReminder r) {
    switch (r.frequency) {
      case 'weekly':
        final days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        return 'Hàng tuần — ${days[r.dayOfWeek ?? 0]} lúc ${r.hour.toString().padLeft(2, '0')}:${r.minute.toString().padLeft(2, '0')}';
      case 'monthly':
        return 'Ngày ${r.dayOfMonth} hàng tháng lúc ${r.hour.toString().padLeft(2, '0')}:${r.minute.toString().padLeft(2, '0')}';
      default:
        return 'Hàng ngày lúc ${r.hour.toString().padLeft(2, '0')}:${r.minute.toString().padLeft(2, '0')}';
    }
  }
}

// ─── Add Dialog ─────────────────────────────────────────────────────────────

class _AddReminderDialog extends StatefulWidget {
  const _AddReminderDialog();

  @override
  State<_AddReminderDialog> createState() => _AddReminderDialogState();
}

class _AddReminderDialogState extends State<_AddReminderDialog> {
  final _titleCtrl = TextEditingController();
  String _frequency = 'monthly'; // daily, weekly, monthly
  int _dayOfMonth = 10;
  int _dayOfWeek = 1; // Monday
  TimeOfDay _time = const TimeOfDay(hour: 8, minute: 0);

  @override
  void dispose() {
    _titleCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Thêm nhắc nhở định kỳ'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _titleCtrl,
              decoration: const InputDecoration(labelText: 'Nội dung nhắc nhở', hintText: 'VD: Đóng tiền nước'),
              autofocus: true,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _frequency,
              decoration: const InputDecoration(labelText: 'Tần suất'),
              items: const [
                DropdownMenuItem(value: 'daily', child: Text('Hàng ngày')),
                DropdownMenuItem(value: 'weekly', child: Text('Hàng tuần')),
                DropdownMenuItem(value: 'monthly', child: Text('Hàng tháng')),
              ],
              onChanged: (v) => setState(() => _frequency = v ?? 'monthly'),
            ),
            const SizedBox(height: 12),
            if (_frequency == 'monthly')
              DropdownButtonFormField<int>(
                value: _dayOfMonth,
                decoration: const InputDecoration(labelText: 'Ngày trong tháng'),
                items: List.generate(28, (i) => DropdownMenuItem(value: i + 1, child: Text('Ngày ${i + 1}'))),
                onChanged: (v) => setState(() => _dayOfMonth = v ?? 10),
              ),
            if (_frequency == 'weekly')
              DropdownButtonFormField<int>(
                value: _dayOfWeek,
                decoration: const InputDecoration(labelText: 'Ngày trong tuần'),
                items: const [
                  DropdownMenuItem(value: 1, child: Text('Thứ 2')),
                  DropdownMenuItem(value: 2, child: Text('Thứ 3')),
                  DropdownMenuItem(value: 3, child: Text('Thứ 4')),
                  DropdownMenuItem(value: 4, child: Text('Thứ 5')),
                  DropdownMenuItem(value: 5, child: Text('Thứ 6')),
                  DropdownMenuItem(value: 6, child: Text('Thứ 7')),
                  DropdownMenuItem(value: 0, child: Text('Chủ nhật')),
                ],
                onChanged: (v) => setState(() => _dayOfWeek = v ?? 1),
              ),
            const SizedBox(height: 12),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Giờ nhắc'),
              trailing: Text('${_time.hour.toString().padLeft(2, '0')}:${_time.minute.toString().padLeft(2, '0')}',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              onTap: () async {
                final picked = await showTimePicker(context: context, initialTime: _time);
                if (picked != null) setState(() => _time = picked);
              },
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Hủy')),
        FilledButton(
          onPressed: () {
            if (_titleCtrl.text.trim().isEmpty) return;
            Navigator.pop(context, RecurringReminder(
              id: DateTime.now().millisecondsSinceEpoch.toString(),
              title: _titleCtrl.text.trim(),
              frequency: _frequency,
              dayOfMonth: _dayOfMonth,
              dayOfWeek: _dayOfWeek,
              hour: _time.hour,
              minute: _time.minute,
              enabled: true,
            ));
          },
          child: const Text('Thêm'),
        ),
      ],
    );
  }
}

// ─── Model ──────────────────────────────────────────────────────────────────

class RecurringReminder {
  final String id;
  final String title;
  final String frequency; // daily, weekly, monthly
  final int dayOfMonth;
  final int? dayOfWeek;
  final int hour;
  final int minute;
  final bool enabled;

  RecurringReminder({
    required this.id,
    required this.title,
    required this.frequency,
    this.dayOfMonth = 1,
    this.dayOfWeek,
    this.hour = 8,
    this.minute = 0,
    this.enabled = true,
  });

  RecurringReminder copyWith({bool? enabled}) => RecurringReminder(
    id: id, title: title, frequency: frequency,
    dayOfMonth: dayOfMonth, dayOfWeek: dayOfWeek,
    hour: hour, minute: minute, enabled: enabled ?? this.enabled,
  );

  Map<String, dynamic> toMap() => {
    'id': id, 'title': title, 'frequency': frequency,
    'dayOfMonth': dayOfMonth, 'dayOfWeek': dayOfWeek,
    'hour': hour, 'minute': minute, 'enabled': enabled,
  };

  factory RecurringReminder.fromMap(Map<String, dynamic> m) => RecurringReminder(
    id: m['id'] as String? ?? '',
    title: m['title'] as String? ?? '',
    frequency: m['frequency'] as String? ?? 'monthly',
    dayOfMonth: m['dayOfMonth'] as int? ?? 1,
    dayOfWeek: m['dayOfWeek'] as int?,
    hour: m['hour'] as int? ?? 8,
    minute: m['minute'] as int? ?? 0,
    enabled: m['enabled'] as bool? ?? true,
  );
}
