import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/security_provider.dart';
import '../../services/passcode_service.dart';
import '../../services/security_service.dart';

/// PasscodeLockScreen — app-open lock. Verifies PASSCODE (not encryption PIN).
/// Accepts 4-6 digits + explicit OK button. Biometric optional.
class PinLockScreen extends StatefulWidget {
  const PinLockScreen({super.key});

  @override
  State<PinLockScreen> createState() => _PinLockScreenState();
}

class _PinLockScreenState extends State<PinLockScreen> {
  String _enteredPin = '';
  int _attempts = 0;
  bool _isLocked = false;
  bool _busy = false;
  bool _biometricEnabled = false;
  String _errorMessage = '';

  @override
  void initState() { super.initState(); _checkBiometric(); }

  Future<void> _checkBiometric() async {
    final enabled = await SecurityService.instance.isBiometricEnabled();
    if (mounted) { setState(() => _biometricEnabled = enabled); if (enabled) _authenticateWithBiometric(); }
  }

  Future<void> _authenticateWithBiometric() async {
    final success = await SecurityService.instance.authenticateBiometric();
    if (success && mounted) _unlockApp();
  }

  void _unlockApp() { context.read<SecurityProvider>().unlock(); }

  void _onNumberPressed(int number) {
    if (_isLocked || _busy || _enteredPin.length >= 6) return;
    setState(() { _enteredPin += number.toString(); _errorMessage = ''; });
  }

  void _onDeletePressed() {
    if (_isLocked || _busy || _enteredPin.isEmpty) return;
    setState(() { _enteredPin = _enteredPin.substring(0, _enteredPin.length - 1); _errorMessage = ''; });
  }

  Future<void> _verifyPasscode() async {
    if (_enteredPin.length < 4 || _busy) return;
    setState(() { _busy = true; _errorMessage = ''; });
    final correct = await PasscodeService.instance.verify(_enteredPin);
    if (!mounted) return;
    setState(() => _busy = false);
    if (correct) { _unlockApp(); }
    else {
      _attempts++;
      if (_attempts >= 5) {
        setState(() { _isLocked = true; _enteredPin = ''; _errorMessage = 'Thử lại sau 30 giây'; });
        Future.delayed(const Duration(seconds: 30), () { if (mounted) setState(() { _isLocked = false; _attempts = 0; _errorMessage = ''; }); });
      } else {
        setState(() { _enteredPin = ''; _errorMessage = 'Passcode sai. Còn ${5 - _attempts} lần thử'; });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1a1a2e),
      body: SafeArea(
        child: Column(children: [
          const Spacer(flex: 2),
          const Icon(Icons.lock_outline, size: 48, color: Colors.white70),
          const SizedBox(height: 24),
          const Text('Nhập Passcode', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          const Text('Khóa ứng dụng', style: TextStyle(color: Colors.white54, fontSize: 12)),
          const SizedBox(height: 28),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: List.generate(6, (i) => Container(
            margin: const EdgeInsets.symmetric(horizontal: 10), width: 15, height: 15,
            decoration: BoxDecoration(shape: BoxShape.circle, color: i < _enteredPin.length ? Colors.white : Colors.transparent, border: Border.all(color: Colors.white70, width: 2)),
          ))),
          const SizedBox(height: 14),
          SizedBox(height: 22, child: Text(_errorMessage, style: const TextStyle(color: Colors.redAccent, fontSize: 14))),
          const Spacer(flex: 1),
          _buildNumberPad(),
          const SizedBox(height: 14),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 48), child: SizedBox(width: double.infinity, child: FilledButton(
            onPressed: (_isLocked || _busy || _enteredPin.length < 4) ? null : _verifyPasscode,
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF6C2BD9), padding: const EdgeInsets.symmetric(vertical: 14)),
            child: Text(_busy ? 'Đang kiểm tra...' : 'OK', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          ))),
          const SizedBox(height: 8),
          if (_biometricEnabled) TextButton.icon(onPressed: (_isLocked || _busy) ? null : _authenticateWithBiometric, icon: const Icon(Icons.fingerprint, color: Colors.white70), label: const Text('Vân tay / Face ID', style: TextStyle(color: Colors.white70))),
          const Spacer(flex: 1),
        ]),
      ),
    );
  }

  Widget _buildNumberPad() => Padding(padding: const EdgeInsets.symmetric(horizontal: 48), child: Column(children: [
    _buildNumberRow([1, 2, 3]), const SizedBox(height: 14),
    _buildNumberRow([4, 5, 6]), const SizedBox(height: 14),
    _buildNumberRow([7, 8, 9]), const SizedBox(height: 14),
    Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
      const SizedBox(width: 64, height: 64), _buildNumberButton(0),
      SizedBox(width: 64, height: 64, child: IconButton(onPressed: _onDeletePressed, icon: const Icon(Icons.backspace_outlined, color: Colors.white70, size: 24))),
    ]),
  ]));

  Widget _buildNumberRow(List<int> numbers) => Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: numbers.map((n) => _buildNumberButton(n)).toList());
  Widget _buildNumberButton(int number) => SizedBox(width: 64, height: 64, child: TextButton(
    onPressed: (_isLocked || _busy) ? null : () => _onNumberPressed(number),
    style: TextButton.styleFrom(shape: const CircleBorder(side: BorderSide(color: Colors.white24))),
    child: Text(number.toString(), style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w400)),
  ));
}
