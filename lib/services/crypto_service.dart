import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:cryptography/cryptography.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// CryptoService — Cross-client E2E encryption (Phase 6.0).
/// IDENTICAL envelope spec to WebApp + Chrome Extension so the SAME PIN
/// unlocks the SAME data on all clients and on Google Drive.
///
/// SHARED SPEC (must match webapp/chrome-extension cryptoService.ts):
/// - KDF:  PBKDF2-HMAC-SHA256, 310,000 iterations, 256-bit key
/// - Enc:  AES-256-GCM, random 12-byte IV, 16-byte GCM tag APPENDED to ciphertext
///         (Web Crypto returns ct||tag; the `cryptography` package returns them
///          separately as SecretBox.cipherText + SecretBox.mac, so we concat/split).
/// - Envelope carries its own random salt + iv (base64). PIN is the only shared secret.
///
/// Envelope JSON:
/// {
///   "__enc": true, "version": 1, "algorithm": "AES-256-GCM", "kdf": "PBKDF2-SHA256",
///   "iterations": 310000, "salt": <b64>, "iv": <b64>, "ciphertext": <b64 = ct||tag>,
///   "updatedAt": <iso>
/// }
class CryptoService {
  CryptoService._();
  static final CryptoService instance = CryptoService._();

  static const String _enabledKey = 'pdp_enc_enabled';
  static const String _verifyKey = 'pdp_enc_verify';
  static const int iterations = 310000;
  static const int envelopeVersion = 1;

  final Pbkdf2 _pbkdf2 =
      Pbkdf2(macAlgorithm: Hmac.sha256(), iterations: iterations, bits: 256);
  // AesGcm.with256bits() defaults to a 12-byte nonce and a 16-byte (128-bit) tag,
  // matching Web Crypto's AES-GCM defaults.
  final AesGcm _aesGcm = AesGcm.with256bits();

  String? _pin;
  final Map<String, SecretKey> _keyCache = {};
  Uint8List? _sessionSalt;

  bool hasKey() => _pin != null;

  Future<bool> isEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_enabledKey) ?? false;
  }

  Future<bool> isLocked() async => (await isEnabled()) && !hasKey();

  /// True if [x] looks like an encrypted envelope produced by any client.
  bool isEncryptedEnvelope(dynamic x) {
    return x is Map &&
        x['__enc'] == true &&
        x['ciphertext'] is String;
  }

  // ── internal helpers ──────────────────────────────────────────────────────

  Uint8List _randomBytes(int n) {
    final rnd = Random.secure();
    final b = Uint8List(n);
    for (var i = 0; i < n; i++) {
      b[i] = rnd.nextInt(256);
    }
    return b;
  }

  Future<SecretKey> _deriveKey(String pin, Uint8List salt) async {
    final saltB64 = base64.encode(salt);
    final cached = _keyCache[saltB64];
    if (cached != null) return cached;
    final key = await _pbkdf2.deriveKey(
      secretKey: SecretKey(utf8.encode(pin)),
      nonce: salt,
    );
    _keyCache[saltB64] = key;
    return key;
  }

  Future<String> _pbkdf2Raw(String pin, Uint8List salt) async {
    final key = await _pbkdf2.deriveKey(
      secretKey: SecretKey(utf8.encode(pin)),
      nonce: salt,
    );
    final bytes = await key.extractBytes();
    return base64.encode(bytes);
  }

  // ── encryption ──────────────────────────────────────────────────────────

  /// Encrypt an arbitrary JSON-serializable object into an envelope.
  Future<Map<String, dynamic>> encryptData(Map<String, dynamic> data) async {
    final pin = _pin;
    if (pin == null) throw StateError('LOCKED');
    _sessionSalt ??= _randomBytes(16);
    final salt = _sessionSalt!;
    final key = await _deriveKey(pin, salt);
    final iv = _randomBytes(12);
    final plain = utf8.encode(jsonEncode(data));
    final box = await _aesGcm.encrypt(plain, secretKey: key, nonce: iv);
    // Match Web Crypto ct||tag layout.
    final ctWithTag = Uint8List.fromList([...box.cipherText, ...box.mac.bytes]);
    return {
      '__enc': true,
      'version': envelopeVersion,
      'algorithm': 'AES-256-GCM',
      'kdf': 'PBKDF2-SHA256',
      'iterations': iterations,
      'salt': base64.encode(salt),
      'iv': base64.encode(iv),
      'ciphertext': base64.encode(ctWithTag),
      'updatedAt': DateTime.now().toUtc().toIso8601String(),
    };
  }

  /// Decrypt an envelope produced by any client. Throws on wrong key / tampering.
  Future<Map<String, dynamic>> decryptData(Map<String, dynamic> env) async {
    final pin = _pin;
    if (pin == null) throw StateError('LOCKED');
    final version = env['version'];
    if (version != envelopeVersion) {
      throw StateError('Unsupported envelope version $version');
    }
    final data = await _decryptWith(pin, env);
    if (data == null) throw StateError('DECRYPT_FAILED');
    return data;
  }

  Future<Map<String, dynamic>?> _decryptWith(
      String pin, Map<String, dynamic> env) async {
    try {
      final salt = Uint8List.fromList(base64.decode(env['salt'] as String));
      final iv = Uint8List.fromList(base64.decode(env['iv'] as String));
      final ctWithTag =
          Uint8List.fromList(base64.decode(env['ciphertext'] as String));
      if (ctWithTag.length < 16) return null;
      final cipherText = ctWithTag.sublist(0, ctWithTag.length - 16);
      final macBytes = ctWithTag.sublist(ctWithTag.length - 16);
      final key = await _deriveKey(pin, salt);
      final clear = await _aesGcm.decrypt(
        SecretBox(cipherText, nonce: iv, mac: Mac(macBytes)),
        secretKey: key,
      );
      return jsonDecode(utf8.decode(clear)) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  // ── PIN lifecycle ─────────────────────────────────────────────────────────

  /// Establish a brand-new PIN on this device and enable encryption.
  Future<void> setupPin(String pin) async {
    final verifySalt = _randomBytes(16);
    final hash = await _pbkdf2Raw(pin, verifySalt);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _verifyKey,
      jsonEncode({
        'salt': base64.encode(verifySalt),
        'iterations': iterations,
        'hash': hash,
      }),
    );
    await prefs.setBool(_enabledKey, true);
    _pin = pin;
    _keyCache.clear();
    _sessionSalt = _randomBytes(16);
  }

  /// Verify [pin] against the local verify token; loads the key on success.
  Future<bool> verifyPin(String pin) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_verifyKey);
    if (raw == null) return false;
    try {
      final token = jsonDecode(raw) as Map<String, dynamic>;
      final salt =
          Uint8List.fromList(base64.decode(token['salt'] as String));
      final hash = await _pbkdf2Raw(pin, salt);
      if (hash == token['hash']) {
        _pin = pin;
        _keyCache.clear();
        _sessionSalt = _randomBytes(16);
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  /// Fresh-client onboarding: decrypt a remote envelope directly with [pin] to
  /// validate it, then create a local verify token + enable encryption.
  /// Returns the decrypted data on success, or null on wrong PIN / bad envelope.
  Future<Map<String, dynamic>?> establishFromEnvelope(
      String pin, Map<String, dynamic> env) async {
    if (env['version'] != envelopeVersion) return null;
    final data = await _decryptWith(pin, env);
    if (data == null) {
      _keyCache.clear();
      return null;
    }
    _pin = pin;
    final verifySalt = _randomBytes(16);
    final hash = await _pbkdf2Raw(pin, verifySalt);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _verifyKey,
      jsonEncode({
        'salt': base64.encode(verifySalt),
        'iterations': iterations,
        'hash': hash,
      }),
    );
    await prefs.setBool(_enabledKey, true);
    _sessionSalt = _randomBytes(16);
    return data;
  }

  /// Disable encryption on this device.
  Future<void> disable() async {
    _pin = null;
    _keyCache.clear();
    _sessionSalt = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_enabledKey);
    await prefs.remove(_verifyKey);
  }

  Future<bool> changePin(String oldPin, String newPin) async {
    if (!await verifyPin(oldPin)) return false;
    await setupPin(newPin);
    return true;
  }

  /// Drop the in-memory key (lock without disabling).
  void clearKey() {
    _pin = null;
    _keyCache.clear();
    _sessionSalt = null;
  }
}
