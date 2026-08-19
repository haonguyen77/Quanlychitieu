import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:timezone/data/latest.dart' as tz_data;
import '../screens/settings/recurring_reminder_screen.dart';

class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  static const String _channelId = 'expense_tracker_channel';
  static const String _channelName = 'Quản lý chi tiêu';
  static const String _channelDesc = 'Thông báo nhắc nhở chi tiêu';

  // SharedPreferences keys
  static const String _keyDailyEnabled = 'notification_daily_enabled';
  static const String _keyDailyHour = 'notification_daily_hour';
  static const String _keyDailyMinute = 'notification_daily_minute';
  static const String _keyDaily2Enabled = 'notification_daily2_enabled';
  static const String _keyDaily2Hour = 'notification_daily2_hour';
  static const String _keyDaily2Minute = 'notification_daily2_minute';
  static const String _keyCreditCardEnabled = 'notification_credit_card_enabled';
  static const String _keyRecurringEnabled = 'notification_recurring_enabled';
  static const String _keyBudgetEnabled = 'notification_budget_enabled';

  // Notification IDs
  static const int _dailyReminderId = 1000;
  static const int _dailyReminder2Id = 1001;
  static const int _budgetAlertBaseId = 2000;
  static const int _recurringBaseId = 3000;
  static const int _creditCardBaseId = 4000;

  Future<void> init() async {
    tz_data.initializeTimeZones();
    // Set local timezone explicitly for Vietnam
    try {
      tz.setLocalLocation(tz.getLocation('Asia/Ho_Chi_Minh'));
    } catch (_) {
      // Fallback: use UTC+7
      tz.setLocalLocation(tz.getLocation('Asia/Bangkok'));
    }

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidSettings);

    await _plugin.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTap,
    );

    // Create notification channel
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(
          const AndroidNotificationChannel(
            _channelId,
            _channelName,
            description: _channelDesc,
            importance: Importance.high,
          ),
        );

    // Request notification permission (Android 13+)
    await _requestNotificationPermission();

    // Reschedule daily reminder if enabled
    final prefs = await SharedPreferences.getInstance();

    // First launch: enable daily reminder at 20:00 by default
    if (!prefs.containsKey(_keyDailyEnabled)) {
      await prefs.setBool(_keyDailyEnabled, true);
      await prefs.setInt(_keyDailyHour, 20);
      await prefs.setInt(_keyDailyMinute, 0);
      // Also auto-enable credit card and recurring reminders
      await prefs.setBool(_keyCreditCardEnabled, true);
      await prefs.setBool(_keyRecurringEnabled, true);
    }

    final dailyEnabled = prefs.getBool(_keyDailyEnabled) ?? true;
    if (dailyEnabled) {
      final hour = prefs.getInt(_keyDailyHour) ?? 20;
      final minute = prefs.getInt(_keyDailyMinute) ?? 0;
      await scheduleDailyReminder(TimeOfDay(hour: hour, minute: minute));
    }

    // Reschedule daily reminder 2 if enabled
    final daily2Enabled = prefs.getBool(_keyDaily2Enabled) ?? false;
    if (daily2Enabled) {
      final hour2 = prefs.getInt(_keyDaily2Hour) ?? 12;
      final minute2 = prefs.getInt(_keyDaily2Minute) ?? 0;
      await scheduleDailyReminder2(TimeOfDay(hour: hour2, minute: minute2));
    }

    // Start periodic checker (guaranteed to work since show() works)
    _startPeriodicCheck();
  }

  /// Request POST_NOTIFICATIONS permission on Android 13+
  Future<void> _requestNotificationPermission() async {
    final androidPlugin = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    if (androidPlugin != null) {
      await androidPlugin.requestNotificationsPermission();
      // Also request exact alarm permission (Android 12+)
      await androidPlugin.requestExactAlarmsPermission();
    }
  }

  void _onNotificationTap(NotificationResponse response) {
    // Handle notification tap - can navigate to specific screen
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMER-BASED NOTIFICATION CHECKER
  // Since zonedSchedule doesn't work reliably on many Android devices,
  // we use a periodic timer that checks every 30s if it's time to notify.
  // ═══════════════════════════════════════════════════════════════════════════

  Timer? _checkTimer;
  String? _lastFiredMinute; // Prevent firing multiple times in same minute

  void _startPeriodicCheck() {
    _checkTimer?.cancel();
    _checkTimer = Timer.periodic(const Duration(seconds: 30), (_) => _checkAndFire());
    // Also check immediately
    _checkAndFire();
  }

  Future<void> _checkAndFire() async {
    final now = DateTime.now();
    final currentMinute = '${now.hour}:${now.minute}';
    
    // Don't fire twice in the same minute
    if (_lastFiredMinute == currentMinute) return;

    final prefs = await SharedPreferences.getInstance();

    // Check daily reminder 1
    final daily1Enabled = prefs.getBool(_keyDailyEnabled) ?? false;
    if (daily1Enabled) {
      final h = prefs.getInt(_keyDailyHour) ?? 20;
      final m = prefs.getInt(_keyDailyMinute) ?? 0;
      if (now.hour == h && now.minute == m) {
        _lastFiredMinute = currentMinute;
        await _fireNotification(_dailyReminderId, 'Nhắc nhở chi tiêu', 'Bạn đã nhập chi tiêu hôm nay chưa? Hãy ghi lại ngay!');
        return;
      }
    }

    // Check daily reminder 2
    final daily2Enabled = prefs.getBool(_keyDaily2Enabled) ?? false;
    if (daily2Enabled) {
      final h = prefs.getInt(_keyDaily2Hour) ?? 12;
      final m = prefs.getInt(_keyDaily2Minute) ?? 0;
      if (now.hour == h && now.minute == m) {
        _lastFiredMinute = currentMinute;
        await _fireNotification(_dailyReminder2Id, 'Nhắc nhở chi tiêu', 'Đừng quên ghi lại chi tiêu trong ngày!');
        return;
      }
    }
  }

  Future<void> _fireNotification(int id, String title, String body) async {
    try {
      await _plugin.show(
        id,
        title,
        body,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            _channelName,
            channelDescription: _channelDesc,
            importance: Importance.high,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
            autoCancel: false,
          ),
        ),
      );
      debugPrint('[NOTIF] Fired: $title at ${DateTime.now()}');
    } catch (e) {
      debugPrint('[NOTIF] Fire failed: $e');
    }
  }

  // --- Settings getters ---

  Future<bool> isDailyReminderEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyDailyEnabled) ?? true;
  }

  Future<TimeOfDay> getDailyReminderTime() async {
    final prefs = await SharedPreferences.getInstance();
    final hour = prefs.getInt(_keyDailyHour) ?? 20;
    final minute = prefs.getInt(_keyDailyMinute) ?? 0;
    return TimeOfDay(hour: hour, minute: minute);
  }

  Future<bool> isDailyReminder2Enabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyDaily2Enabled) ?? false;
  }

  Future<TimeOfDay> getDailyReminder2Time() async {
    final prefs = await SharedPreferences.getInstance();
    final hour = prefs.getInt(_keyDaily2Hour) ?? 12;
    final minute = prefs.getInt(_keyDaily2Minute) ?? 0;
    return TimeOfDay(hour: hour, minute: minute);
  }

  Future<bool> isCreditCardReminderEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyCreditCardEnabled) ?? false;
  }

  Future<bool> isRecurringReminderEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyRecurringEnabled) ?? false;
  }

  Future<bool> isBudgetAlertEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyBudgetEnabled) ?? false;
  }

  // --- Settings setters ---

  Future<void> setDailyReminderEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyDailyEnabled, enabled);
    if (!enabled) {
      await cancelDailyReminder();
    } else {
      final time = await getDailyReminderTime();
      await scheduleDailyReminder(time);
    }
  }

  Future<void> setDailyReminder2Enabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyDaily2Enabled, enabled);
    if (!enabled) {
      await _plugin.cancel(_dailyReminder2Id);
    } else {
      final time = await getDailyReminder2Time();
      await scheduleDailyReminder2(time);
    }
  }

  Future<void> setCreditCardReminderEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyCreditCardEnabled, enabled);
  }

  Future<void> setRecurringReminderEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyRecurringEnabled, enabled);
  }

  Future<void> setBudgetAlertEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyBudgetEnabled, enabled);
  }

  // --- Scheduling ---

  Future<void> scheduleDailyReminder(TimeOfDay time) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_keyDailyHour, time.hour);
    await prefs.setInt(_keyDailyMinute, time.minute);
    await prefs.setBool(_keyDailyEnabled, true);

    await _plugin.cancel(_dailyReminderId);

    final now = tz.TZDateTime.now(tz.local);
    var scheduled = tz.TZDateTime(
      tz.local,
      now.year,
      now.month,
      now.day,
      time.hour,
      time.minute,
    );

    if (scheduled.isBefore(now)) {
      scheduled = scheduled.add(const Duration(days: 1));
    }

    try {
      await _plugin.zonedSchedule(
        _dailyReminderId,
        'Nhắc nhở chi tiêu',
        'Bạn đã nhập chi tiêu hôm nay chưa? Hãy ghi lại ngay!',
        scheduled,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            _channelName,
            channelDescription: _channelDesc,
            importance: Importance.high,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
            autoCancel: false,
          ),
        ),
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
        matchDateTimeComponents: DateTimeComponents.time,
      );
      debugPrint('[NOTIF] Scheduled daily reminder at $scheduled (now=$now)');
      // Verify it was actually scheduled
      final pending = await _plugin.pendingNotificationRequests();
      debugPrint('[NOTIF] Pending notifications: ${pending.length} — IDs: ${pending.map((p) => p.id).toList()}');
    } catch (e) {
      // Permission denied or other error - fail gracefully
      debugPrint('NotificationService: Failed to schedule daily reminder: $e');
    }
  }

  Future<void> cancelDailyReminder() async {
    await _plugin.cancel(_dailyReminderId);
  }

  Future<void> cancelDailyReminder2() async {
    await _plugin.cancel(_dailyReminder2Id);
  }

  Future<void> scheduleDailyReminder2(TimeOfDay time) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_keyDaily2Hour, time.hour);
    await prefs.setInt(_keyDaily2Minute, time.minute);
    await prefs.setBool(_keyDaily2Enabled, true);

    await _plugin.cancel(_dailyReminder2Id);

    final now = tz.TZDateTime.now(tz.local);
    var scheduled = tz.TZDateTime(
      tz.local,
      now.year,
      now.month,
      now.day,
      time.hour,
      time.minute,
    );

    if (scheduled.isBefore(now)) {
      scheduled = scheduled.add(const Duration(days: 1));
    }

    try {
      await _plugin.zonedSchedule(
        _dailyReminder2Id,
        'Nhắc nhở buổi tối',
        'Đừng quên ghi lại chi tiêu trong ngày!',
        scheduled,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            _channelName,
            channelDescription: _channelDesc,
            importance: Importance.high,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
            autoCancel: false,
          ),
        ),
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
        matchDateTimeComponents: DateTimeComponents.time,
      );
    } catch (e) {
      debugPrint('NotificationService: Failed to schedule daily reminder 2: $e');
    }
  }

  Future<void> showBudgetAlert(
      String categoryName, double spent, double budget) async {
    final prefs = await SharedPreferences.getInstance();
    final enabled = prefs.getBool(_keyBudgetEnabled) ?? false;
    if (!enabled) return;

    final id = _budgetAlertBaseId + categoryName.hashCode.abs() % 999;

    try {
      await _plugin.show(
        id,
        'Vượt ngân sách!',
        '$categoryName: Đã chi ${_formatMoney(spent)} / ${_formatMoney(budget)}',
        const NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            _channelName,
            channelDescription: _channelDesc,
            importance: Importance.high,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
            autoCancel: false,
          ),
        ),
      );
    } catch (e) {
      debugPrint('NotificationService: Failed to show budget alert: $e');
    }
  }

  Future<void> showRecurringReminder(String title, double amount) async {
    final prefs = await SharedPreferences.getInstance();
    final enabled = prefs.getBool(_keyRecurringEnabled) ?? false;
    if (!enabled) return;

    final id = _recurringBaseId + title.hashCode.abs() % 999;

    try {
      await _plugin.show(
        id,
        'Giao dịch định kỳ',
        '$title: ${_formatMoney(amount)}',
        const NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            _channelName,
            channelDescription: _channelDesc,
            importance: Importance.high,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
            autoCancel: false,
          ),
        ),
      );
    } catch (e) {
      debugPrint('NotificationService: Failed to show recurring reminder: $e');
    }
  }

  Future<void> showCreditCardDue(
      String cardName, DateTime dueDate, double amount) async {
    final prefs = await SharedPreferences.getInstance();
    final enabled = prefs.getBool(_keyCreditCardEnabled) ?? false;
    if (!enabled) return;

    final id = _creditCardBaseId + cardName.hashCode.abs() % 999;

    try {
      await _plugin.show(
        id,
        'Nhắc thanh toán thẻ',
        '$cardName: ${_formatMoney(amount)} - Hạn ${dueDate.day}/${dueDate.month}',
        const NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            _channelName,
            channelDescription: _channelDesc,
            importance: Importance.high,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
            autoCancel: false,
          ),
        ),
      );
    } catch (e) {
      debugPrint('NotificationService: Failed to show credit card due: $e');
    }
  }

  String _formatMoney(double amount) {
    final value = amount.toInt();
    final text = value.toString();
    final buffer = StringBuffer();
    int count = 0;
    for (int i = text.length - 1; i >= 0; i--) {
      buffer.write(text[i]);
      count++;
      if (count % 3 == 0 && i > 0) {
        buffer.write('.');
      }
    }
    return '${buffer.toString().split('').reversed.join()}đ';
  }

  /// Schedule recurring reminders from saved list
  Future<void> scheduleRecurringReminders(List<RecurringReminder> reminders) async {
    // Cancel all existing recurring (IDs 5000-5999)
    for (int i = 0; i < 100; i++) {
      await _plugin.cancel(5000 + i);
    }

    int idx = 0;
    for (final r in reminders) {
      if (!r.enabled) continue;
      if (idx >= 100) break;

      final now = tz.TZDateTime.now(tz.local);
      tz.TZDateTime scheduled;

      switch (r.frequency) {
        case 'daily':
          scheduled = tz.TZDateTime(tz.local, now.year, now.month, now.day, r.hour, r.minute);
          if (scheduled.isBefore(now)) scheduled = scheduled.add(const Duration(days: 1));
          break;
        case 'weekly':
          scheduled = tz.TZDateTime(tz.local, now.year, now.month, now.day, r.hour, r.minute);
          while (scheduled.weekday != (r.dayOfWeek ?? 1) || scheduled.isBefore(now)) {
            scheduled = scheduled.add(const Duration(days: 1));
          }
          break;
        case 'monthly':
        default:
          int day = r.dayOfMonth;
          if (day > 28) day = 28; // Safety
          scheduled = tz.TZDateTime(tz.local, now.year, now.month, day, r.hour, r.minute);
          if (scheduled.isBefore(now)) {
            scheduled = tz.TZDateTime(tz.local, now.year, now.month + 1, day, r.hour, r.minute);
          }
          break;
      }

      try {
        await _plugin.zonedSchedule(
          5000 + idx,
          'Nhắc nhở định kỳ',
          r.title,
          scheduled,
          const NotificationDetails(
            android: AndroidNotificationDetails(
              _channelId, _channelName,
              channelDescription: _channelDesc,
              importance: Importance.high,
              priority: Priority.high,
              icon: '@mipmap/ic_launcher',
              autoCancel: false,
            ),
          ),
          androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
          uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
          matchDateTimeComponents: r.frequency == 'daily'
              ? DateTimeComponents.time
              : r.frequency == 'weekly'
                  ? DateTimeComponents.dayOfWeekAndTime
                  : DateTimeComponents.dayOfMonthAndTime,
        );
      } catch (e) {
        debugPrint('NotificationService: Failed to schedule recurring: $e');
      }
      idx++;
    }
  }

  /// Send a test notification immediately (for debugging)
  Future<void> sendTestNotification() async {
    try {
      await _plugin.show(
        9999,
        'Test thông báo',
        'Nếu bạn thấy thông báo này, hệ thống thông báo đang hoạt động!',
        const NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            _channelName,
            channelDescription: _channelDesc,
            importance: Importance.high,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
          ),
        ),
      );
    } catch (e) {
      debugPrint('NotificationService: Test notification failed: $e');
    }
  }

  /// Schedule a test notification 60 seconds from now (TEST 2)
  Future<String> scheduleTestNotification() async {
    final results = StringBuffer();
    
    try {
      // 1. Check permissions
      final androidPlugin = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      final notifGranted = await androidPlugin?.areNotificationsEnabled() ?? false;
      results.writeln('1. Notification permission: ${notifGranted ? "GRANTED" : "DENIED"}');
      
      // 2. Timezone info
      final now = tz.TZDateTime.now(tz.local);
      results.writeln('2. Timezone: ${tz.local.name}, now=$now');
      
      // 3. Schedule 60s from now
      final scheduled = now.add(const Duration(seconds: 60));
      results.writeln('3. Scheduling at: $scheduled (60s from now)');
      
      await _plugin.zonedSchedule(
        9998,
        'Test scheduled',
        'Notification scheduled 60s trước đã fire!',
        scheduled,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            _channelName,
            channelDescription: _channelDesc,
            importance: Importance.high,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
          ),
        ),
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
      );
      results.writeln('4. zonedSchedule() called OK (no exception)');
      
      // 4. Verify pending
      final pending = await _plugin.pendingNotificationRequests();
      final testPending = pending.where((p) => p.id == 9998).toList();
      results.writeln('5. Pending total: ${pending.length}, test ID 9998: ${testPending.isNotEmpty ? "FOUND" : "NOT FOUND"}');
      
      if (testPending.isNotEmpty) {
        results.writeln('   → Title: ${testPending.first.title}');
        results.writeln('   → Body: ${testPending.first.body}');
      }
      
      // 5. List all pending IDs
      results.writeln('6. All pending IDs: ${pending.map((p) => p.id).toList()}');
      
    } catch (e) {
      results.writeln('ERROR: $e');
    }
    
    debugPrint('[NOTIF-TEST] $results');
    return results.toString();
  }
}
