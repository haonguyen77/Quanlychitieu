import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:cryptography/cryptography.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// PasscodeService — App-lock passcode, COMPLETELY INDEPENDENT from encryption PIN.
/// Passcode only controls access to the UI.
/// Passcode does NOT derive encryption keys or affect Google Drive sync.
/// Stored as PBKDF2 hash (never plaintext).
class PasscodeService {
  PasscodeService._();
  static final PasscodeService instance = PasscodeService._();

  static const String _enabledKey = 'pdp_passcode_enabled';
  static const String _verifyKey = 'pdp_passcode_verify';
  static const int _iterations = 100000;

  final Pbkdf2 _pbkdf2 = Pbkdf2(macAlgorithm: Hmac.sha256(), iterations: _iterations, bits: 256);

  Future<bool> isEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_enabledKey) ?? false;
  }

  Future<bool> verify(String passcode) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_verifyKey);
    if (raw == null) return false;
    try {
      final token = jsonDecode(raw) as Map<String, dynamic>;
      final salt = Uint8List.fromList(base64.decode(token['salt'] as String));
      final hash = await _hash(passcode, salt);
      return hash == token['hash'];
    } catch (_) { return false; }
  }

  Future<void> setup(String passcode) async {
    final salt = _randomBytes(16);
    final hash = await _hash(passcode, salt);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_verifyKey, jsonEncode({ 'salt': base64.encode(salt), 'iterations': _iterations, 'hash': hash }));
    await prefs.setBool(_enabledKey, true);
  }

  Future<bool> change(String oldPasscode, String newPasscode) async {
    if (!await verify(oldPasscode)) return false;
    await setup(newPasscode);
    return true;
  }

  Future<bool> disable(String passcode) async {
    if (!await verify(passcode)) return false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_enabledKey);
    await prefs.remove(_verifyKey);
    return true;
  }

  Future<String> _hash(String passcode, Uint8List salt) async {
    final key = await _pbkdf2.deriveKey(secretKey: SecretKey(utf8.encode(passcode)), nonce: salt);
    final bytes = await key.extractBytes();
    return base64.encode(bytes);
  }

  Uint8List _randomBytes(int n) {
    final rnd = Random.secure();
    return Uint8List.fromList(List.generate(n, (_) => rnd.nextInt(256)));
  }
}
