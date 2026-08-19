import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'sync_service.dart';

/// Auto-sync manager: triggers background sync after data changes and on app open.
class AutoSync {
  AutoSync._();
  static final AutoSync instance = AutoSync._();

  static const _debounceMs = 2000; // 2 seconds after last change (reduced from 5s)
  Timer? _debounceTimer;
  bool _initialized = false;
  GoogleSignInAccount? _cachedUser; // Cache authenticated user to avoid re-auth on every sync

  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['https://www.googleapis.com/auth/drive'],
  );

  /// Initialize auto-sync (call once on app start)
  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;
    await _syncOnOpen();
  }

  /// Notify that data has changed - will trigger sync after debounce
  void notifyDataChanged() {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: _debounceMs), () {
      _syncInBackground();
    });
  }

  /// Get authenticated user, using cache if still valid.
  /// Only calls signInSilently if no cached user.
  Future<GoogleSignInAccount?> _getUser() async {
    // If we have a cached user, verify it's still the current user
    if (_cachedUser != null) {
      // GoogleSignIn.currentUser is synchronous — no network call
      final current = _googleSignIn.currentUser;
      if (current != null && current.id == _cachedUser!.id) {
        return _cachedUser;
      }
    }
    // No cache or stale — do signInSilently (network call, but unavoidable)
    _cachedUser = await _googleSignIn.signInSilently();
    return _cachedUser;
  }

  /// Clear cached user (call on logout)
  void clearCachedUser() {
    _cachedUser = null;
  }

  Future<void> _syncOnOpen() async {
    try {
      final user = await _getUser();
      if (user == null) return;
      debugPrint('[AutoSync] Syncing on app open...');
      await SyncService.instance.fullSync(user);
    } catch (e) {
      debugPrint('[AutoSync] Sync on open failed: $e');
    }
  }

  Future<void> _syncInBackground() async {
    try {
      final user = await _getUser();
      if (user == null) return;
      debugPrint('[AutoSync] Background sync (debounce=${_debounceMs}ms)...');
      await SyncService.instance.quickPush(user);
    } catch (e) {
      debugPrint('[AutoSync] Background sync failed: $e');
      // If auth failed, clear cache so next attempt re-authenticates
      if (e.toString().contains('Auth') || e.toString().contains('401')) {
        _cachedUser = null;
      }
    }
  }

  void dispose() {
    _debounceTimer?.cancel();
  }
}
