import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../screens/home/home_screen.dart';
import '../screens/security/pin_lock_screen.dart';
import '../providers/security_provider.dart';
import '../providers/theme_provider.dart';

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<ThemeProvider>(
      builder: (context, themeProvider, child) {
        return MaterialApp(
          title: 'Quản lý chi tiêu',
          debugShowCheckedModeBanner: false,
          theme: themeProvider.buildLightTheme(),
          darkTheme: themeProvider.buildDarkTheme(),
          themeMode: themeProvider.themeMode,
          home: Consumer<SecurityProvider>(
            builder: (context, security, child) {
              if (security.isLocked) {
                return const PinLockScreen();
              }
              return const HomeScreen();
            },
          ),
        );
      },
    );
  }
}
