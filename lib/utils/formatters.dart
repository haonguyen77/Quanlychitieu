import 'package:intl/intl.dart';
import '../app/constants.dart';

class Formatters {
  /// Global privacy mode flag — when true, amounts are hidden
  static bool privacyMode = false;

  static final _currencyFormat = NumberFormat.currency(
    locale: AppConstants.currencyLocale,
    symbol: AppConstants.currencySymbol,
    decimalDigits: 0,
  );

  static final _dateFormat = DateFormat(AppConstants.dateFormat);
  static final _dateTimeFormat = DateFormat(AppConstants.dateTimeFormat);
  static final _monthYearFormat = DateFormat(AppConstants.monthYearFormat);

  static String currency(double amount) {
    if (privacyMode) return '••••••';
    return _currencyFormat.format(amount);
  }

  /// Compact money format using M for millions.
  /// 3.000.000 → 3M, 3.500.000 → 3M5, 3.150.000 → 3M15
  /// Under 1M: uses comma format (e.g. 800,000)
  static String currencyCompact(double amount) {
    if (privacyMode) return '•••';
    final abs = amount.abs();
    final sign = amount < 0 ? '-' : '';

    if (abs < 1000000) {
      // Under 1M: show with commas
      return '$sign${_formatWithCommas(abs.round())}';
    }

    final millions = (abs / 1000000).floor();
    final remainder = ((abs - millions * 1000000) / 100000).round();

    if (remainder == 0) {
      return '$sign${millions}M';
    }

    // Check if we need 1 or 2 digits after M
    final hundredThousands = ((abs - millions * 1000000) / 100000).floor();
    final tenThousands = ((abs - millions * 1000000 - hundredThousands * 100000) / 10000).round();

    if (tenThousands == 0) {
      return '$sign${millions}M$hundredThousands';
    }
    return '$sign${millions}M$hundredThousands$tenThousands';
  }

  /// Format number with comma separators
  static String _formatWithCommas(int number) {
    final str = number.toString();
    final buffer = StringBuffer();
    for (int i = 0; i < str.length; i++) {
      if (i > 0 && (str.length - i) % 3 == 0) buffer.write(',');
      buffer.write(str[i]);
    }
    return buffer.toString();
  }

  static String date(DateTime date) {
    return _dateFormat.format(date);
  }

  static String dateTime(DateTime dateTime) {
    return _dateTimeFormat.format(dateTime);
  }

  static String monthYear(DateTime date) {
    return _monthYearFormat.format(date);
  }

  static String relativeDate(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final target = DateTime(date.year, date.month, date.day);
    final diff = today.difference(target).inDays;

    if (diff == 0) return 'Hôm nay';
    if (diff == 1) return 'Hôm qua';
    if (diff == -1) return 'Ngày mai';
    return _dateFormat.format(date);
  }
}
