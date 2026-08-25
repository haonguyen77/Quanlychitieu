import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../providers/account_provider.dart';
import '../../utils/formatters.dart';
import '../../utils/icon_helper.dart';
import '../../utils/color_helper.dart';
import '../../utils/money_input_formatter.dart';

class TransferScreen extends StatefulWidget {
  const TransferScreen({super.key});

  @override
  State<TransferScreen> createState() => _TransferScreenState();
}

class _TransferScreenState extends State<TransferScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _noteController = TextEditingController();

  String? _fromAccountId;
  String? _toAccountId;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AccountProvider>().loadAccounts();
    });
  }

  @override
  void dispose() {
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chuyển tiền'),
      ),
      body: Consumer<AccountProvider>(
        builder: (context, provider, child) {
          final accounts = provider.accounts;

          return Form(
            key: _formKey,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // From account
                  DropdownButtonFormField<String>(
                    value: _fromAccountId,
                    decoration: const InputDecoration(
                      labelText: 'Từ tài khoản',
                      prefixIcon: Icon(Icons.output),
                    ),
                    items: accounts
                        .where((acc) => acc.id != _toAccountId)
                        .map((acc) => DropdownMenuItem(
                              value: acc.id,
                              child: Row(
                                children: [
                                  Icon(
                                    IconHelper.getIcon(acc.icon),
                                    size: 18,
                                    color: ColorHelper.getColor(acc.color),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(acc.name),
                                  const Spacer(),
                                  Text(
                                    Formatters.currency(acc.currentBalance),
                                    style: Theme.of(context).textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ))
                        .toList(),
                    onChanged: (value) {
                      setState(() => _fromAccountId = value);
                    },
                    validator: (value) {
                      if (value == null) return 'Vui lòng chọn tài khoản';
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Swap button
                  Center(
                    child: IconButton.filled(
                      onPressed: () {
                        setState(() {
                          final temp = _fromAccountId;
                          _fromAccountId = _toAccountId;
                          _toAccountId = temp;
                        });
                      },
                      icon: const Icon(Icons.swap_vert),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // To account
                  DropdownButtonFormField<String>(
                    value: _toAccountId,
                    decoration: const InputDecoration(
                      labelText: 'Đến tài khoản',
                      prefixIcon: Icon(Icons.input),
                    ),
                    items: accounts
                        .where((acc) => acc.id != _fromAccountId)
                        .map((acc) => DropdownMenuItem(
                              value: acc.id,
                              child: Row(
                                children: [
                                  Icon(
                                    IconHelper.getIcon(acc.icon),
                                    size: 18,
                                    color: ColorHelper.getColor(acc.color),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(acc.name),
                                  const Spacer(),
                                  Text(
                                    Formatters.currency(acc.currentBalance),
                                    style: Theme.of(context).textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ))
                        .toList(),
                    onChanged: (value) {
                      setState(() => _toAccountId = value);
                    },
                    validator: (value) {
                      if (value == null) return 'Vui lòng chọn tài khoản';
                      return null;
                    },
                  ),
                  const SizedBox(height: 24),

                  // Amount
                  TextFormField(
                    controller: _amountController,
                    keyboardType: TextInputType.number,
                    inputFormatters: [MoneyInputFormatter()],
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                    textAlign: TextAlign.center,
                    decoration: InputDecoration(
                      hintText: '0',
                      suffixText: '₫',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      filled: true,
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Vui lòng nhập số tiền';
                      }
                      final amount = double.tryParse(value);
                      if (amount == null || amount <= 0) {
                        return 'Số tiền không hợp lệ';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Note
                  TextFormField(
                    controller: _noteController,
                    decoration: const InputDecoration(
                      labelText: 'Ghi chú',
                      hintText: 'Ví dụ: Rút tiền ATM...',
                      prefixIcon: Icon(Icons.notes_outlined),
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Transfer button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: FilledButton.icon(
                      onPressed: _isLoading ? null : _transfer,
                      icon: _isLoading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.swap_horiz),
                      label: const Text('Chuyển tiền'),
                    ),
                  ),

                  const SizedBox(height: 12),
                  Center(
                    child: Text(
                      'Chuyển tiền giữa tài khoản không tính là chi tiêu',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.outline,
                          ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _transfer() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final provider = context.read<AccountProvider>();
      final amount = MoneyInputFormatter.parse(_amountController.text);

      await provider.transfer(
        fromAccountId: _fromAccountId!,
        toAccountId: _toAccountId!,
        amount: amount,
        note: _noteController.text.trim().isEmpty
            ? null
            : _noteController.text.trim(),
      );

      if (mounted) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Đã chuyển ${Formatters.currency(amount)}'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Lỗi: ${e.toString()}'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }
}
