import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/security_provider.dart';
import '../../services/security_service.dart';

class PinLockScreen extends StatefulWidget {
  const PinLockScreen({super.key});

  @override
  State<PinLockScreen> createState() => _PinLockScreenState();
}

class _PinLockScreenState extends State<PinLockScreen> {
  String _enteredPin = '';
  int _attempts = 0;
  bool _isLocked = false;
  bool _biometricEnabled = false;
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    _checkBiometric();
  }

  Future<void> _checkBiometric() async {
    final enabled = await SecurityService.instance.isBiometricEnabled();
    if (mounted) {
      setState(() => _biometricEnabled = enabled);
      if (enabled) {
        _authenticateWithBiometric();
      }
    }
  }

  Future<void> _authenticateWithBiometric() async {
    final success = await SecurityService.instance.authenticateBiometric();
    if (success && mounted) {
      _unlockApp();
    }
  }

  void _unlockApp() {
    context.read<SecurityProvider>().unlock();
  }

  void _onNumberPressed(int number) {
    if (_isLocked) return;
    if (_enteredPin.length >= 4) return;

    setState(() {
      _enteredPin += number.toString();
      _errorMessage = '';
    });

    if (_enteredPin.length == 4) {
      _verifyPin();
    }
  }

  void _onDeletePressed() {
    if (_isLocked) return;
    if (_enteredPin.isEmpty) return;

    setState(() {
      _enteredPin = _enteredPin.substring(0, _enteredPin.length - 1);
      _errorMessage = '';
    });
  }

  Future<void> _verifyPin() async {
    final correct = await SecurityService.instance.verifyPin(_enteredPin);
    if (correct) {
      _unlockApp();
    } else {
      _attempts++;
      if (_attempts >= 5) {
        setState(() {
          _isLocked = true;
          _enteredPin = '';
          _errorMessage = 'Thử lại sau 30 giây';
        });
        Future.delayed(const Duration(seconds: 30), () {
          if (mounted) {
            setState(() {
              _isLocked = false;
              _attempts = 0;
              _errorMessage = '';
            });
          }
        });
      } else {
        setState(() {
          _enteredPin = '';
          _errorMessage = 'Mật khẩu sai. Còn ${5 - _attempts} lần thử';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1a1a2e),
      body: SafeArea(
        child: Column(
          children: [
            const Spacer(flex: 2),
            // Lock icon
            const Icon(
              Icons.lock_outline,
              size: 48,
              color: Colors.white70,
            ),
            const SizedBox(height: 24),
            const Text(
              'Nhập mật khẩu PIN',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 32),
            // PIN dots
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(4, (index) {
                final filled = index < _enteredPin.length;
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 12),
                  width: 16,
                  height: 16,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: filled ? Colors.white : Colors.transparent,
                    border: Border.all(color: Colors.white70, width: 2),
                  ),
                );
              }),
            ),
            const SizedBox(height: 16),
            // Error message
            SizedBox(
              height: 24,
              child: Text(
                _errorMessage,
                style: const TextStyle(color: Colors.redAccent, fontSize: 14),
              ),
            ),
            const Spacer(flex: 1),
            // Number pad
            _buildNumberPad(),
            const SizedBox(height: 16),
            // Biometric button
            if (_biometricEnabled)
              TextButton.icon(
                onPressed: _isLocked ? null : _authenticateWithBiometric,
                icon: const Icon(Icons.fingerprint, color: Colors.white70),
                label: const Text(
                  'Dùng vân tay',
                  style: TextStyle(color: Colors.white70),
                ),
              ),
            const Spacer(flex: 1),
          ],
        ),
      ),
    );
  }

  Widget _buildNumberPad() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 48),
      child: Column(
        children: [
          _buildNumberRow([1, 2, 3]),
          const SizedBox(height: 16),
          _buildNumberRow([4, 5, 6]),
          const SizedBox(height: 16),
          _buildNumberRow([7, 8, 9]),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              // Empty space
              const SizedBox(width: 64, height: 64),
              _buildNumberButton(0),
              // Delete button
              SizedBox(
                width: 64,
                height: 64,
                child: IconButton(
                  onPressed: _onDeletePressed,
                  icon: const Icon(
                    Icons.backspace_outlined,
                    color: Colors.white70,
                    size: 24,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildNumberRow(List<int> numbers) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: numbers.map((n) => _buildNumberButton(n)).toList(),
    );
  }

  Widget _buildNumberButton(int number) {
    return SizedBox(
      width: 64,
      height: 64,
      child: TextButton(
        onPressed: _isLocked ? null : () => _onNumberPressed(number),
        style: TextButton.styleFrom(
          shape: const CircleBorder(
            side: BorderSide(color: Colors.white24),
          ),
        ),
        child: Text(
          number.toString(),
          style: const TextStyle(
            color: Colors.white,
            fontSize: 24,
            fontWeight: FontWeight.w400,
          ),
        ),
      ),
    );
  }
}
