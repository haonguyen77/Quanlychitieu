import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SecurityService {
  SecurityService._();
  static final SecurityService instance = SecurityService._();

  final LocalAuthentication _localAuth = LocalAuthentication();

  // SharedPreferences keys
  static const String _keyPinEnabled = 'security_pin_enabled';
  static const String _keyPin = 'security_pin';
  static const String _keyBiometricEnabled = 'security_biometric_enabled';
  static const String _keyPrivacyMode = 'security_privacy_mode';
  static const String _keyAutoLockMinutes = 'security_auto_lock_minutes';

  // --- PIN ---

  Future<bool> isPinEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyPinEnabled) ?? false;
  }

  Future<void> setPinEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyPinEnabled, enabled);
  }

  Future<String?> getPin() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyPin);
  }

  Future<void> setPin(String pin) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyPin, pin);
  }

  Future<bool> verifyPin(String input) async {
    final stored = await getPin();
    return stored != null && stored == input;
  }

  // --- Biometric ---

  Future<bool> isBiometricEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyBiometricEnabled) ?? false;
  }

  Future<void> setBiometricEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyBiometricEnabled, enabled);
  }

  Future<bool> isBiometricAvailable() async {
    try {
      final canCheck = await _localAuth.canCheckBiometrics;
      final isDeviceSupported = await _localAuth.isDeviceSupported();
      return canCheck && isDeviceSupported;
    } catch (e) {
      debugPrint('SecurityService: Biometric check failed: $e');
      return false;
    }
  }

  Future<bool> authenticateBiometric() async {
    try {
      return await _localAuth.authenticate(
        localizedReason: 'Xác thực để mở ứng dụng',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );
    } catch (e) {
      debugPrint('SecurityService: Biometric auth failed: $e');
      return false;
    }
  }

  // --- Privacy Mode ---

  Future<bool> isPrivacyMode() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyPrivacyMode) ?? false;
  }

  Future<void> setPrivacyMode(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyPrivacyMode, enabled);
  }

  // --- Auto Lock ---

  Future<int> getAutoLockMinutes() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_keyAutoLockMinutes) ?? 0; // 0 = immediate
  }

  Future<void> setAutoLockMinutes(int minutes) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_keyAutoLockMinutes, minutes);
  }
}
