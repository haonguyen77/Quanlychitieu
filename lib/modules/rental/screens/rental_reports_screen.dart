import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:provider/provider.dart';
import '../providers/rental_provider.dart';
import '../../../utils/formatters.dart';

class RentalReportsScreen extends StatefulWidget {
  const RentalReportsScreen({super.key});

  @override
  State<RentalReportsScreen> createState() => _RentalReportsScreenState();
}

class _RentalReportsScreenState extends State<RentalReportsScreen> {
  List<Map<String, dynamic>> _reportData = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadReport());
  }

  Future<void> _loadReport() async {
    final provider = context.read<RentalProvider>();
    final data = await provider.getMonthlyReport();
    setState(() {
      _reportData = data;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Báo cáo')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildChartCard(context),
                  const SizedBox(height: 16),
                  _buildSummaryCard(context),
                  const SizedBox(height: 16),
                  _buildMonthlyDetailList(context),
                ],
              ),
            ),
    );
  }

  Widget _buildChartCard(BuildContext context) {
    final maxY = _reportData.fold<double>(0, (max, item) {
      final paid = (item['paid_total'] as double);
      return paid > max ? paid : max;
    });

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Thu nhập 12 tháng gần nhất', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),
            SizedBox(
              height: 200,
              child: BarChart(
                BarChartData(
                  alignment: BarChartAlignment.spaceAround,
                  maxY: maxY > 0 ? maxY * 1.2 : 10000000,
                  barTouchData: BarTouchData(
                    touchTooltipData: BarTouchTooltipData(
                      getTooltipItem: (group, groupIndex, rod, rodIndex) {
                        return BarTooltipItem(
                          Formatters.currency(rod.toY),
                          const TextStyle(color: Colors.white, fontSize: 11),
                        );
                      },
                    ),
                  ),
                  titlesData: FlTitlesData(
                    show: true,
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (value, meta) {
                          final index = value.toInt();
                          if (index < 0 || index >= _reportData.length) return const SizedBox();
                          return Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              'T${_reportData[index]['month']}',
                              style: const TextStyle(fontSize: 10),
                            ),
                          );
                        },
                      ),
                    ),
                    leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  ),
                  borderData: FlBorderData(show: false),
                  gridData: const FlGridData(show: false),
                  barGroups: List.generate(_reportData.length, (index) {
                    final item = _reportData[index];
                    return BarChartGroupData(
                      x: index,
                      barRods: [
                        BarChartRodData(
                          toY: item['paid_total'] as double,
                          color: Colors.green.shade400,
                          width: 14,
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                        ),
                      ],
                    );
                  }),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryCard(BuildContext context) {
    final totalPaid = _reportData.fold<double>(0, (sum, item) => sum + (item['paid_total'] as double));
    final totalUnpaid = _reportData.fold<double>(0, (sum, item) => sum + (item['unpaid_total'] as double));
    final totalBills = _reportData.fold<int>(0, (sum, item) => sum + (item['bill_count'] as int));
    final paidBills = _reportData.fold<int>(0, (sum, item) => sum + (item['paid_count'] as int));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Tổng kết', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            _buildSummaryRow(context, 'Tổng đã thu', Formatters.currency(totalPaid), Colors.green),
            _buildSummaryRow(context, 'Tổng chưa thu', Formatters.currency(totalUnpaid), Colors.orange),
            _buildSummaryRow(context, 'Tổng hóa đơn', '$totalBills', Colors.blue),
            _buildSummaryRow(context, 'Đã thanh toán', '$paidBills / $totalBills', Colors.green),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryRow(BuildContext context, String label, String value, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          Text(value, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600, color: color)),
        ],
      ),
    );
  }

  Widget _buildMonthlyDetailList(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Chi tiết theo tháng', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            ..._reportData.reversed.map((item) {
              final paid = item['paid_total'] as double;
              final unpaid = item['unpaid_total'] as double;
              final month = item['month'] as int;
              final year = item['year'] as int;
              if (paid == 0 && unpaid == 0) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    SizedBox(
                      width: 72,
                      child: Text('T$month/$year', style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500)),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (paid > 0)
                            Text('Thu: ${Formatters.currency(paid)}', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.green)),
                          if (unpaid > 0)
                            Text('Chưa thu: ${Formatters.currency(unpaid)}', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.orange)),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
