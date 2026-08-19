import 'package:flutter/material.dart';
import '../services/security_service.dart';
import '../utils/formatters.dart';

class SecurityProvider extends ChangeNotifier {
  bool _isLocked = false;
  bool _isPrivacyMode = false;
  DateTime? _lastActiveTime;

  bool get isLocked => _isLocked;
  bool get isPrivacyMode => _isPrivacyMode;

  SecurityProvider() {
    _init();
  }

  Future<void> _init() async {
    final pinEnabled = await SecurityService.instance.isPinEnabled();
    _isLocked = pinEnabled;
    _isPrivacyMode = await SecurityService.instance.isPrivacyMode();
    Formatters.privacyMode = _isPrivacyMode;
    notifyListeners();
  }

  void lock() {
    _isLocked = true;
    notifyListeners();
  }

  void unlock() {
    _isLocked = false;
    _lastActiveTime = DateTime.now();
    notifyListeners();
  }

  void togglePrivacyMode() {
    _isPrivacyMode = !_isPrivacyMode;
    Formatters.privacyMode = _isPrivacyMode;
    SecurityService.instance.setPrivacyMode(_isPrivacyMode);
    notifyListeners();
  }

  void setPrivacyMode(bool value) {
    _isPrivacyMode = value;
    Formatters.privacyMode = value;
    notifyListeners();
  }

  /// Call when app resumes from background.
  /// Checks if enough time has passed to auto-lock.
  Future<void> checkShouldLock(DateTime lastActive) async {
    final pinEnabled = await SecurityService.instance.isPinEnabled();
    if (!pinEnabled) return;

    final autoLockMinutes = await SecurityService.instance.getAutoLockMinutes();

    // -1 means never auto-lock
    if (autoLockMinutes == -1) return;

    final now = DateTime.now();
    final elapsedSeconds = now.difference(lastActive).inSeconds;

    // Convert stored value to seconds for comparison
    // Special: value 0 = immediate (always lock), negative values reserved for -1 (never)
    int thresholdSeconds;
    if (autoLockMinutes == 0) {
      thresholdSeconds = 0; // immediate
    } else {
      // Values stored as seconds directly (30, 60, 300, 900)
      thresholdSeconds = autoLockMinutes;
    }

    if (elapsedSeconds >= thresholdSeconds) {
      lock();
    }
  }

  void recordLastActive() {
    _lastActiveTime = DateTime.now();
  }

  DateTime? get lastActiveTime => _lastActiveTime;
}
