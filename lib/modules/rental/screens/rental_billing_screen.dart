import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/rental_provider.dart';
import '../models/rental_models.dart';
import '../../../utils/formatters.dart';

class RentalBillingScreen extends StatefulWidget {
  const RentalBillingScreen({super.key});

  @override
  State<RentalBillingScreen> createState() => _RentalBillingScreenState();
}

class _RentalBillingScreenState extends State<RentalBillingScreen> {
  late int _selectedYear;
  late int _selectedMonth;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _selectedYear = now.year;
    _selectedMonth = now.month;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RentalProvider>().loadBills(_selectedYear, _selectedMonth);
    });
  }

  void _changeMonth(int direction) {
    setState(() {
      _selectedMonth += direction;
      if (_selectedMonth > 12) {
        _selectedMonth = 1;
        _selectedYear++;
      } else if (_selectedMonth < 1) {
        _selectedMonth = 12;
        _selectedYear--;
      }
    });
    context.read<RentalProvider>().loadBills(_selectedYear, _selectedMonth);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Hóa đơn tháng')),
      body: Consumer<RentalProvider>(
        builder: (context, provider, child) {
          return Column(
            children: [
              // Month/Year selector
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
                child: Row(
                  children: [
                    IconButton(icon: const Icon(Icons.chevron_left), onPressed: () => _changeMonth(-1)),
                    Expanded(
                      child: Text(
                        'Tháng $_selectedMonth/$_selectedYear',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                      ),
                    ),
                    IconButton(icon: const Icon(Icons.chevron_right), onPressed: () => _changeMonth(1)),
                  ],
                ),
              ),

              // Actions
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          provider.createBillsForAllRooms(_selectedYear, _selectedMonth);
                        },
                        icon: const Icon(Icons.add_circle_outline, size: 18),
                        label: const Text('Tạo hóa đơn tất cả phòng'),
                      ),
                    ),
                  ],
                ),
              ),

              // Bills list
              Expanded(
                child: provider.isLoading
                    ? const Center(child: CircularProgressIndicator())
                    : provider.bills.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.receipt_long_outlined, size: 48, color: Theme.of(context).colorScheme.outline),
                                const SizedBox(height: 12),
                                Text('Chưa có hóa đơn tháng này', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.outline)),
                                const SizedBox(height: 8),
                                Text('Nhấn "Tạo hóa đơn tất cả phòng" để bắt đầu', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.outline)),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            itemCount: provider.bills.length,
                            itemBuilder: (context, index) => _buildBillCard(context, provider.bills[index], provider),
                          ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildBillCard(BuildContext context, RentalMonthlyBill bill, RentalProvider provider) {
    final isPaid = bill.paymentStatus == 'paid';
    final statusColor = isPaid ? Colors.green : Colors.orange;
    final statusText = isPaid ? 'Đã thanh toán' : 'Chưa thanh toán';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => _showBillEditForm(context, bill),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(bill.roomName ?? 'Phòng', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                        if (bill.tenantName != null)
                          Text(bill.tenantName!, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.blue)),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(statusText, style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w500)),
                  ),
                ],
              ),
              const Divider(height: 16),

              // Details
              _buildDetailRow(context, 'Tiền thuê', Formatters.currency(bill.rentAmount)),
              if (bill.electricityNew > bill.electricityOld)
                _buildDetailRow(context, 'Điện (${bill.electricityNew - bill.electricityOld} kWh)', Formatters.currency(bill.electricityAmount)),
              if (bill.waterAmount > 0)
                _buildDetailRow(context, 'Nước', Formatters.currency(bill.waterAmount)),
              if (bill.internetAmount > 0)
                _buildDetailRow(context, 'Internet', Formatters.currency(bill.internetAmount)),
              if (bill.otherAmount > 0)
                _buildDetailRow(context, 'Khác${bill.otherNote != null ? ' (${bill.otherNote})' : ''}', Formatters.currency(bill.otherAmount)),

              const Divider(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Tổng: ${Formatters.currency(bill.totalAmount)}',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary),
                    ),
                  ),
                  if (!isPaid)
                    FilledButton.tonal(
                      onPressed: () => provider.markAsPaid(bill.id, _selectedYear, _selectedMonth),
                      child: const Text('Đã thanh toán'),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDetailRow(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          Text(value, style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  void _showBillEditForm(BuildContext context, RentalMonthlyBill bill) {
    final rentCtrl = TextEditingController(text: bill.rentAmount.toStringAsFixed(0));
    final elOldCtrl = TextEditingController(text: bill.electricityOld.toString());
    final elNewCtrl = TextEditingController(text: bill.electricityNew.toString());
    final elPriceCtrl = TextEditingController(text: bill.electricityPrice.toStringAsFixed(0));
    final waterCtrl = TextEditingController(text: bill.waterAmount.toStringAsFixed(0));
    final internetCtrl = TextEditingController(text: bill.internetAmount.toStringAsFixed(0));
    final otherCtrl = TextEditingController(text: bill.otherAmount.toStringAsFixed(0));
    final otherNoteCtrl = TextEditingController(text: bill.otherNote ?? '');
    final noteCtrl = TextEditingController(text: bill.note ?? '');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 16, right: 16, top: 24,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Sửa hóa đơn - ${bill.roomName ?? ""}', style: Theme.of(ctx).textTheme.titleLarge),
              const SizedBox(height: 16),
              TextField(
                controller: rentCtrl,
                decoration: const InputDecoration(labelText: 'Tiền thuê', border: OutlineInputBorder(), suffixText: '₫'),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: elOldCtrl,
                      decoration: const InputDecoration(labelText: 'Số điện cũ', border: OutlineInputBorder()),
                      keyboardType: TextInputType.number,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: elNewCtrl,
                      decoration: const InputDecoration(labelText: 'Số điện mới', border: OutlineInputBorder()),
                      keyboardType: TextInputType.number,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: elPriceCtrl,
                decoration: const InputDecoration(labelText: 'Giá điện/kWh', border: OutlineInputBorder(), suffixText: '₫'),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: waterCtrl,
                decoration: const InputDecoration(labelText: 'Tiền nước', border: OutlineInputBorder(), suffixText: '₫'),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: internetCtrl,
                decoration: const InputDecoration(labelText: 'Internet', border: OutlineInputBorder(), suffixText: '₫'),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: otherCtrl,
                decoration: const InputDecoration(labelText: 'Phí khác', border: OutlineInputBorder(), suffixText: '₫'),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: otherNoteCtrl,
                decoration: const InputDecoration(labelText: 'Ghi chú phí khác', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteCtrl,
                decoration: const InputDecoration(labelText: 'Ghi chú', border: OutlineInputBorder()),
                maxLines: 2,
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    final provider = context.read<RentalProvider>();
                    final updatedBill = bill.copyWith(
                      rentAmount: double.tryParse(rentCtrl.text) ?? 0,
                      electricityOld: int.tryParse(elOldCtrl.text) ?? 0,
                      electricityNew: int.tryParse(elNewCtrl.text) ?? 0,
                      electricityPrice: double.tryParse(elPriceCtrl.text) ?? 3500,
                      waterAmount: double.tryParse(waterCtrl.text) ?? 0,
                      internetAmount: double.tryParse(internetCtrl.text) ?? 0,
                      otherAmount: double.tryParse(otherCtrl.text) ?? 0,
                      otherNote: otherNoteCtrl.text.trim().isEmpty ? null : otherNoteCtrl.text.trim(),
                      note: noteCtrl.text.trim().isEmpty ? null : noteCtrl.text.trim(),
                    );
                    provider.updateBill(updatedBill);
                    Navigator.pop(ctx);
                  },
                  child: const Text('Cập nhật'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
