import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../database/database_helper.dart';

/// NotificationChecker — Data-driven notification generator for Android.
/// Queries the local database and returns notifications that should be fired.
/// Uses stable IDs to prevent duplicates.
/// Does NOT modify any data — read-only.
class NotificationChecker {
  NotificationChecker._();
  static final NotificationChecker instance = NotificationChecker._();

  // SharedPreferences keys for notification settings
  static const String _keyCreditCardEnabled = 'notification_credit_card_enabled';
  static const String _keyRentEnabled = 'notification_rent_enabled';
  static const String _keyWarrantyEnabled = 'notification_warranty_enabled';
  static const String _keyRecurringEnabled = 'notification_recurring_enabled';
  static const String _keyBudgetEnabled = 'notification_budget_enabled';
  static const String _keyReminderDays = 'notification_reminder_days';
  static const String _keyFiredNotifications = 'notification_fired_ids';

  /// Default reminder days: 1, 3, 7
  static const List<int> _defaultReminderDays = [1, 3, 7];

  /// Get reminder days from settings
  Future<List<int>> _getReminderDays() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_keyReminderDays);
    if (raw != null) {
      try {
        return (raw.split(',').map(int.parse).toList())..sort();
      } catch (_) {}
    }
    return _defaultReminderDays;
  }

  /// Get set of notification IDs that have already been fired today
  Future<Set<String>> _getFiredIds() async {
    final prefs = await SharedPreferences.getInstance();
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final key = '${_keyFiredNotifications}_$today';
    final raw = prefs.getString(key);
    if (raw != null && raw.isNotEmpty) {
      return raw.split('|').toSet();
    }
    return {};
  }

  /// Mark a notification ID as fired today
  Future<void> _markFired(String id) async {
    final prefs = await SharedPreferences.getInstance();
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final key = '${_keyFiredNotifications}_$today';
    final existing = prefs.getString(key) ?? '';
    final ids = existing.isEmpty ? <String>{} : existing.split('|').toSet();
    ids.add(id);
    await prefs.setString(key, ids.join('|'));

    // Clean up old days (keep only today and yesterday)
    final yesterday = DateTime.now().subtract(const Duration(days: 1)).toIso8601String().substring(0, 10);
    final allKeys = prefs.getKeys().where((k) => k.startsWith(_keyFiredNotifications)).toList();
    for (final k in allKeys) {
      if (!k.endsWith(today) && !k.endsWith(yesterday)) {
        await prefs.remove(k);
      }
    }
  }

  /// Check all notification types and return list of notifications to fire.
  /// Each notification has: id (stable), title, body, notificationId (int).
  /// Returns only NEW notifications (not yet fired today).
  Future<List<PendingNotification>> checkAll() async {
    final prefs = await SharedPreferences.getInstance();
    final firedIds = await _getFiredIds();
    final reminderDays = await _getReminderDays();
    final results = <PendingNotification>[];

    try {
      // Credit Card
      if (prefs.getBool(_keyCreditCardEnabled) ?? true) {
        results.addAll(await _checkCreditCards(reminderDays));
      }

      // Rent
      if (prefs.getBool(_keyRentEnabled) ?? true) {
        results.addAll(await _checkRent(reminderDays));
      }

      // Warranty
      if (prefs.getBool(_keyWarrantyEnabled) ?? true) {
        results.addAll(await _checkWarranty());
      }

      // Recurring
      if (prefs.getBool(_keyRecurringEnabled) ?? true) {
        results.addAll(await _checkRecurring(reminderDays));
      }

      // Budget
      if (prefs.getBool(_keyBudgetEnabled) ?? true) {
        results.addAll(await _checkBudget());
      }
    } catch (e) {
      debugPrint('[NOTIF-CHECKER] Error: $e');
    }

    // Filter out already-fired notifications
    final newNotifications = results.where((n) => !firedIds.contains(n.stableId)).toList();

    // Mark new ones as fired
    for (final n in newNotifications) {
      await _markFired(n.stableId);
    }

    return newNotifications;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREDIT CARD REMINDERS
  // ═══════════════════════════════════════════════════════════════════════════

  Future<List<PendingNotification>> _checkCreditCards(List<int> reminderDays) async {
    final results = <PendingNotification>[];
    try {
      final db = await DatabaseHelper.instance.database;
      final cards = await db.query('credit_cards', where: 'is_active = 1');

      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);

      for (final card in cards) {
        final name = card['name'] as String? ?? 'Thẻ';
        final last4 = card['last4'] as String?;
        final stmtDay = card['statement_day'] as int? ?? 20;
        final dueDays = card['payment_due_days'] as int? ?? 10;
        final cardId = card['id'] as String;

        // Calculate next due date
        var dueDate = DateTime(now.year, now.month, stmtDay + dueDays);
        if (dueDate.isBefore(today)) {
          dueDate = DateTime(now.year, now.month + 1, stmtDay + dueDays);
        }

        final daysLeft = dueDate.difference(today).inDays;
        final label = last4 != null ? '$name (*$last4)' : name;

        for (final d in reminderDays) {
          if (daysLeft <= d && daysLeft >= 0) {
            final dateStr = '${dueDate.day}/${dueDate.month}';
            results.add(PendingNotification(
              stableId: 'credit_due_${cardId}_${dueDate.toIso8601String().substring(0, 10)}',
              notificationId: 4000 + cardId.hashCode.abs() % 999,
              title: '💳 Sắp đến hạn thanh toán',
              body: 'Thẻ $label — Còn $daysLeft ngày ($dateStr)',
            ));
            break; // Only one notification per card
          }
        }
      }
    } catch (e) {
      debugPrint('[NOTIF-CHECKER] Credit card error: $e');
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENT REMINDERS
  // ═══════════════════════════════════════════════════════════════════════════

  Future<List<PendingNotification>> _checkRent(List<int> reminderDays) async {
    final results = <PendingNotification>[];
    try {
      final prefs = await SharedPreferences.getInstance();
      final dueDay = prefs.getInt('rental_due_day') ?? 29;

      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);

      var nextDue = DateTime(now.year, now.month, dueDay);
      if (nextDue.isBefore(today) || nextDue.isAtSameMomentAs(today)) {
        nextDue = DateTime(now.year, now.month + 1, dueDay);
      }

      final daysLeft = nextDue.difference(today).inDays;
      final dateStr = '${nextDue.day}/${nextDue.month}';

      for (final d in reminderDays) {
        if (daysLeft <= d && daysLeft >= 0) {
          results.add(PendingNotification(
            stableId: 'rent_due_${nextDue.toIso8601String().substring(0, 10)}',
            notificationId: 6000,
            title: '🏠 Sắp đến ngày đóng tiền trọ',
            body: 'Còn $daysLeft ngày (ngày $dateStr)',
          ));
          break;
        }
      }
    } catch (e) {
      debugPrint('[NOTIF-CHECKER] Rent error: $e');
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WARRANTY REMINDERS
  // ═══════════════════════════════════════════════════════════════════════════

  Future<List<PendingNotification>> _checkWarranty() async {
    final results = <PendingNotification>[];
    try {
      final db = await DatabaseHelper.instance.database;
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final limit30 = today.add(const Duration(days: 30));

      // Query transactions with warranty_date in the next 30 days
      final items = await db.rawQuery('''
        SELECT id, title, warranty_date
        FROM transactions
        WHERE warranty_date IS NOT NULL AND is_deleted = 0
          AND warranty_date >= ? AND warranty_date <= ?
        ORDER BY warranty_date ASC
        LIMIT 20
      ''', [today.toIso8601String().substring(0, 10), limit30.toIso8601String().substring(0, 10)]);

      for (final item in items) {
        final id = item['id'] as String;
        final title = item['title'] as String? ?? 'Sản phẩm';
        final warrantyDateStr = item['warranty_date'] as String;
        final warrantyDate = DateTime.parse(warrantyDateStr);
        final daysLeft = warrantyDate.difference(today).inDays;

        // Alert at 7, 15, 30 days
        if (daysLeft <= 30 && daysLeft >= 0) {
          final dateStr = '${warrantyDate.day}/${warrantyDate.month}/${warrantyDate.year}';
          results.add(PendingNotification(
            stableId: 'warranty_${id}_${warrantyDateStr.substring(0, 10)}',
            notificationId: 7000 + id.hashCode.abs() % 999,
            title: '🛡️ Bảo hành sắp hết hạn',
            body: '$title — Còn $daysLeft ngày ($dateStr)',
          ));
        }
      }
    } catch (e) {
      debugPrint('[NOTIF-CHECKER] Warranty error: $e');
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RECURRING TRANSACTION REMINDERS
  // ═══════════════════════════════════════════════════════════════════════════

  Future<List<PendingNotification>> _checkRecurring(List<int> reminderDays) async {
    final results = <PendingNotification>[];
    try {
      final db = await DatabaseHelper.instance.database;
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final maxDay = reminderDays.isNotEmpty ? reminderDays.last : 7;
      final limit = today.add(Duration(days: maxDay));

      final items = await db.rawQuery('''
        SELECT id, title, amount, next_date
        FROM recurring_transactions
        WHERE is_active = 1
          AND next_date IS NOT NULL
          AND next_date >= ? AND next_date <= ?
        ORDER BY next_date ASC
        LIMIT 20
      ''', [today.toIso8601String().substring(0, 10), limit.toIso8601String().substring(0, 10)]);

      for (final item in items) {
        final id = item['id'] as String;
        final title = item['title'] as String? ?? 'Giao dịch';
        final amount = (item['amount'] as num?)?.toDouble() ?? 0;
        final nextDateStr = item['next_date'] as String;
        final nextDate = DateTime.parse(nextDateStr);
        final daysLeft = nextDate.difference(today).inDays;

        for (final d in reminderDays) {
          if (daysLeft <= d && daysLeft >= 0) {
            final amountStr = _formatMoney(amount);
            results.add(PendingNotification(
              stableId: 'recurring_${id}_${nextDateStr.substring(0, 10)}',
              notificationId: 3000 + id.hashCode.abs() % 999,
              title: '🔄 Giao dịch định kỳ sắp tới',
              body: '$title: $amountStr — Còn $daysLeft ngày',
            ));
            break;
          }
        }
      }
    } catch (e) {
      debugPrint('[NOTIF-CHECKER] Recurring error: $e');
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUDGET ALERTS
  // ═══════════════════════════════════════════════════════════════════════════

  Future<List<PendingNotification>> _checkBudget() async {
    final results = <PendingNotification>[];
    try {
      final db = await DatabaseHelper.instance.database;
      final now = DateTime.now();

      final budgets = await db.query('budgets', where: 'is_active = 1');

      for (final budget in budgets) {
        final id = budget['id'] as String;
        final name = budget['name'] as String? ?? 'Ngân sách';
        final amount = (budget['amount'] as num?)?.toDouble() ?? 0;
        if (amount <= 0) continue;

        final period = budget['period'] as String? ?? 'monthly';
        final categoryId = budget['category_id'] as String?;

        // Calculate period start
        DateTime startDate;
        switch (period) {
          case 'weekly':
            startDate = now.subtract(Duration(days: now.weekday - 1));
            startDate = DateTime(startDate.year, startDate.month, startDate.day);
            break;
          case 'yearly':
            startDate = DateTime(now.year, 1, 1);
            break;
          case 'monthly':
          default:
            startDate = DateTime(now.year, now.month, 1);
            break;
        }

        // Query spent amount
        String where = 'type = 0 AND is_deleted = 0 AND date >= ?';
        List<dynamic> whereArgs = [startDate.toIso8601String()];

        if (categoryId != null) {
          where += ' AND category_id = ?';
          whereArgs.add(categoryId);
        }

        final spentResult = await db.rawQuery(
          'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE $where',
          whereArgs,
        );
        final spent = (spentResult.first['total'] as num?)?.toDouble() ?? 0;
        final percentage = (spent / amount * 100).round();

        // Alert at 80%, 90%, 100%
        String? alertLevel;
        if (percentage >= 100) {
          alertLevel = 'vượt';
        } else if (percentage >= 90) {
          alertLevel = '90%';
        } else if (percentage >= 80) {
          alertLevel = '80%';
        }

        if (alertLevel != null) {
          results.add(PendingNotification(
            stableId: 'budget_${id}_${period}_${now.month}_$alertLevel',
            notificationId: 2000 + id.hashCode.abs() % 999,
            title: '💰 Cảnh báo ngân sách',
            body: '$name: Đã chi ${_formatMoney(spent)} / ${_formatMoney(amount)} ($percentage%)',
          ));
        }
      }
    } catch (e) {
      debugPrint('[NOTIF-CHECKER] Budget error: $e');
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILS
  // ═══════════════════════════════════════════════════════════════════════════

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
}

/// A notification ready to be shown.
class PendingNotification {
  /// Stable ID: type_entityId_date — prevents duplicates
  final String stableId;

  /// Android notification ID (int) for flutter_local_notifications
  final int notificationId;

  final String title;
  final String body;

  PendingNotification({
    required this.stableId,
    required this.notificationId,
    required this.title,
    required this.body,
  });
}
