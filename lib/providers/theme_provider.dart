import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeProvider extends ChangeNotifier {
  static const _keyThemeMode = 'theme_mode';
  static const _keyColorIndex = 'theme_color_index';
  static const _keyFontScale = 'theme_font_scale';

  static const List<Color> availableColors = [
    Colors.blue,
    Colors.green,
    Colors.purple,
    Colors.orange,
    Colors.red,
    Colors.teal,
    Colors.indigo,
    Colors.pink,
  ];

  static const List<double> fontScales = [0.8, 0.9, 1.0, 1.1, 1.2];
  static const List<String> fontScaleLabels = ['Nhỏ', 'Vừa', 'Bình thường', 'Lớn', 'Rất lớn'];

  ThemeMode _themeMode = ThemeMode.system;
  int _colorIndex = 0;
  double _fontScale = 1.0;

  ThemeMode get themeMode => _themeMode;
  int get colorIndex => _colorIndex;
  Color get seedColor => availableColors[_colorIndex];
  double get fontScale => _fontScale;

  ThemeProvider() {
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    final modeIndex = prefs.getInt(_keyThemeMode) ?? 0;
    _themeMode = ThemeMode.values[modeIndex.clamp(0, 2)];
    _colorIndex = (prefs.getInt(_keyColorIndex) ?? 0).clamp(0, availableColors.length - 1);
    _fontScale = prefs.getDouble(_keyFontScale) ?? 1.0;
    notifyListeners();
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    _themeMode = mode;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_keyThemeMode, mode.index);
  }

  Future<void> setColorIndex(int index) async {
    _colorIndex = index.clamp(0, availableColors.length - 1);
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_keyColorIndex, _colorIndex);
  }

  Future<void> setFontScale(double scale) async {
    _fontScale = scale;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_keyFontScale, scale);
  }

  ThemeData buildLightTheme() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: seedColor,
        brightness: Brightness.light,
      ),
      brightness: Brightness.light,
      appBarTheme: const AppBarTheme(centerTitle: true, elevation: 0),
      cardTheme: CardThemeData(
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(elevation: 4),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        filled: true,
      ),
      textTheme: _buildTextTheme(Brightness.light),
    );
  }

  ThemeData buildDarkTheme() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: seedColor,
        brightness: Brightness.dark,
      ),
      brightness: Brightness.dark,
      appBarTheme: const AppBarTheme(centerTitle: true, elevation: 0),
      cardTheme: CardThemeData(
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(elevation: 4),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        filled: true,
      ),
      textTheme: _buildTextTheme(Brightness.dark),
    );
  }

  TextTheme _buildTextTheme(Brightness brightness) {
    final base = brightness == Brightness.light
        ? ThemeData.light().textTheme
        : ThemeData.dark().textTheme;
    return base.apply(
      fontSizeFactor: _fontScale,
    );
  }
}
