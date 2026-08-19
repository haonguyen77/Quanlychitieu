import 'package:flutter/material.dart';

class ColorHelper {
  static const List<Color> availableColors = [
    Color(0xFF2196F3), // Blue
    Color(0xFF4CAF50), // Green
    Color(0xFFF44336), // Red
    Color(0xFFFF9800), // Orange
    Color(0xFF9C27B0), // Purple
    Color(0xFF00BCD4), // Cyan
    Color(0xFFE91E63), // Pink
    Color(0xFF607D8B), // Blue Grey
    Color(0xFF795548), // Brown
    Color(0xFF009688), // Teal
    Color(0xFFFF5722), // Deep Orange
    Color(0xFF3F51B5), // Indigo
    Color(0xFFCDDC39), // Lime
    Color(0xFF8BC34A), // Light Green
    Color(0xFFFFC107), // Amber
    Color(0xFF673AB7), // Deep Purple
  ];

  static Color fromHex(String hex) {
    hex = hex.replaceAll('#', '');
    if (hex.length == 6) hex = 'FF$hex';
    return Color(int.parse(hex, radix: 16));
  }

  static String toHex(Color color) {
    final r = (color.r * 255).round().toRadixString(16).padLeft(2, '0');
    final g = (color.g * 255).round().toRadixString(16).padLeft(2, '0');
    final b = (color.b * 255).round().toRadixString(16).padLeft(2, '0');
    return '#$r$g$b'.toUpperCase();
  }

  static Color getColor(String? hex) {
    if (hex == null || hex.isEmpty) return availableColors.first;
    try {
      return fromHex(hex);
    } catch (_) {
      return availableColors.first;
    }
  }
}
