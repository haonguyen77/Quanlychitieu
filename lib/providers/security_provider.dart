import 'package:flutter/material.dart';
import '../services/passcode_service.dart';
import '../services/security_service.dart';
import '../utils/formatters.dart';

/// SecurityProvider — controls app lock state.
/// Now based on PasscodeService (independent from encryption PIN/CryptoService).
class SecurityProvider extends ChangeNotifier {
  bool _isLocked = false;
  bool _isPrivacyMode = false;
  DateTime? _lastActiveTime;

  bool get isLocked => _isLocked;
  bool get isPrivacyMode => _isPrivacyMode;

  SecurityProvider() { _init(); }

  Future<void> _init() async {
    // Lock is determined by Passcode, NOT by encryption PIN.
    final passcodeEnabled = await PasscodeService.instance.isEnabled();
    _isLocked = passcodeEnabled;
    _isPrivacyMode = await SecurityService.instance.isPrivacyMode();
    Formatters.privacyMode = _isPrivacyMode;
    notifyListeners();
  }

  Future<void> refreshLockState() async {
    _isLocked = await PasscodeService.instance.isEnabled();
    notifyListeners();
  }

  void lock() { _isLocked = true; notifyListeners(); }
  void unlock() { _isLocked = false; _lastActiveTime = DateTime.now(); notifyListeners(); }

  void togglePrivacyMode() {
    _isPrivacyMode = !_isPrivacyMode;
    Formatters.privacyMode = _isPrivacyMode;
    SecurityService.instance.setPrivacyMode(_isPrivacyMode);
    notifyListeners();
  }

  void setPrivacyMode(bool value) { _isPrivacyMode = value; Formatters.privacyMode = value; notifyListeners(); }

  Future<void> checkShouldLock(DateTime lastActive) async {
    final passcodeEnabled = await PasscodeService.instance.isEnabled();
    if (!passcodeEnabled) return;
    final autoLockMinutes = await SecurityService.instance.getAutoLockMinutes();
    if (autoLockMinutes == -1) return;
    final elapsedSeconds = DateTime.now().difference(lastActive).inSeconds;
    final thresholdSeconds = autoLockMinutes == 0 ? 0 : autoLockMinutes;
    if (elapsedSeconds >= thresholdSeconds) lock();
  }

  void recordLastActive() { _lastActiveTime = DateTime.now(); }
  DateTime? get lastActiveTime => _lastActiveTime;
}
