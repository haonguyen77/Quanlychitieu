import 'package:flutter/services.dart';

/// Custom TextInputFormatter that adds comma separators for thousands.
/// Usage: inputFormatters: [MoneyInputFormatter()]
/// To get the numeric value: double.parse(controller.text.replaceAll(',', ''))
class MoneyInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = newValue.text.replaceAll(RegExp(r'[^\d]'), '');
    if (digits.isEmpty) {
      return const TextEditingValue(
          text: '', selection: TextSelection.collapsed(offset: 0));
    }

    final buffer = StringBuffer();
    for (int i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(',');
      buffer.write(digits[i]);
    }

    final formatted = buffer.toString();
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }

  /// Helper to parse formatted text back to double
  static double parse(String text) {
    final clean = text.replaceAll(',', '');
    return double.tryParse(clean) ?? 0;
  }

  /// Helper to format a number with commas for display
  static String format(double number) {
    final str = number.toStringAsFixed(0);
    final buffer = StringBuffer();
    for (int i = 0; i < str.length; i++) {
      if (i > 0 && (str.length - i) % 3 == 0) buffer.write(',');
      buffer.write(str[i]);
    }
    return buffer.toString();
  }
}
