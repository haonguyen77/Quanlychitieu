import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import '../providers/gold_provider.dart';
import '../../../utils/formatters.dart';

class GoldReportsScreen extends StatefulWidget {
  const GoldReportsScreen({super.key});

  @override
  State<GoldReportsScreen> createState() => _GoldReportsScreenState();
}

class _GoldReportsScreenState extends State<GoldReportsScreen> {
  List<Map<String, dynamic>> _monthlyValues = [];
  bool _isLoadingChart = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final provider = context.read<GoldProvider>();
      await provider.loadHoldings();
      await provider.loadPriceHistory();
      _loadChartData();
    });
  }

  Future<void> _loadChartData() async {
    final provider = context.read<GoldProvider>();
    final data = await provider.getMonthlyValues();
    setState(() {
      _monthlyValues = data;
      _isLoadingChart = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Báo cáo vàng'),
        backgroundColor: Colors.amber.shade700,
        foregroundColor: Colors.white,
      ),
      body: Consumer<GoldProvider>(
        builder: (context, provider, child) {
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSummaryCard(context, provider),
                const SizedBox(height: 16),
                _buildProfitLossCard(context, provider),
                const SizedBox(height: 16),
                _buildBarChart(context),
                const SizedBox(height: 16),
                _buildPieChart(context, provider),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSummaryCard(BuildContext context, GoldProvider provider) {
    return Card(
      color: Colors.amber.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Tổng quan danh mục',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            _buildInfoRow(context, 'Tổng sở hữu', '${provider.totalQuantityChi.toStringAsFixed(1)} chỉ'),
            _buildInfoRow(context, 'Tổng đã đầu tư', Formatters.currency(provider.totalInvested)),
            _buildInfoRow(context, 'Giá trị hiện tại', Formatters.currency(provider.totalCurrentValue)),
            const Divider(height: 16),
            _buildInfoRow(
              context,
              'Lãi/Lỗ',
              '${provider.totalProfitLoss >= 0 ? '+' : ''}${Formatters.currency(provider.totalProfitLoss)}',
              valueColor: provider.totalProfitLoss >= 0 ? Colors.green.shade700 : Colors.red.shade700,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(BuildContext context, String label, String value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w600,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProfitLossCard(BuildContext context, GoldProvider provider) {
    if (provider.holdings.isEmpty) {
      return const SizedBox.shrink();
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Lãi/Lỗ theo loại vàng',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            ...provider.holdings.map((holding) {
              final isProfit = holding.profitLoss >= 0;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          holding.goldType,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        Text(
                          '${isProfit ? '+' : ''}${Formatters.currency(holding.profitLoss)}',
                          style: TextStyle(
                            color: isProfit ? Colors.green.shade700 : Colors.red.shade700,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Text(
                          '${holding.quantity.toStringAsFixed(1)} chỉ',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '• Giá TB: ${Formatters.currency(holding.avgBuyPrice)}/chỉ',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        Text(
                          'Giá hiện tại: ${Formatters.currency(holding.currentPrice)}/chỉ',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '(${isProfit ? '+' : ''}${holding.profitLossPercent.toStringAsFixed(1)}%)',
                          style: TextStyle(
                            fontSize: 12,
                            color: isProfit ? Colors.green.shade700 : Colors.red.shade700,
                          ),
                        ),
                      ],
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

  Widget _buildBarChart(BuildContext context) {
    if (_isLoadingChart) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    if (_monthlyValues.isEmpty || _monthlyValues.every((d) => (d['value'] as double) == 0)) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Giá trị vàng theo tháng',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 24),
              const Center(child: Text('Chưa có dữ liệu')),
              const SizedBox(height: 24),
            ],
          ),
        ),
      );
    }

    final maxValue = _monthlyValues
        .map((d) => (d['value'] as double))
        .reduce((a, b) => a > b ? a : b);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Giá trị vàng theo tháng',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 200,
              child: BarChart(
                BarChartData(
                  alignment: BarChartAlignment.spaceAround,
                  maxY: maxValue * 1.2,
                  barTouchData: BarTouchData(
                    touchTooltipData: BarTouchTooltipData(
                      getTooltipItem: (group, groupIndex, rod, rodIndex) {
                        final data = _monthlyValues[group.x.toInt()];
                        return BarTooltipItem(
                          'T${data['month']}/${data['year']}\n${Formatters.currency(data['value'] as double)}',
                          const TextStyle(color: Colors.white, fontSize: 12),
                        );
                      },
                    ),
                  ),
                  titlesData: FlTitlesData(
                    show: true,
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (value, meta) {
                          final index = value.toInt();
                          if (index >= 0 && index < _monthlyValues.length) {
                            return Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                'T${_monthlyValues[index]['month']}',
                                style: const TextStyle(fontSize: 10),
                              ),
                            );
                          }
                          return const SizedBox.shrink();
                        },
                      ),
                    ),
                  ),
                  borderData: FlBorderData(show: false),
                  barGroups: _monthlyValues.asMap().entries.map((entry) {
                    return BarChartGroupData(
                      x: entry.key,
                      barRods: [
                        BarChartRodData(
                          toY: entry.value['value'] as double,
                          color: Colors.amber.shade600,
                          width: 14,
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                        ),
                      ],
                    );
                  }).toList(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPieChart(BuildContext context, GoldProvider provider) {
    if (provider.holdings.isEmpty) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Tỷ lệ danh mục',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 24),
              const Center(child: Text('Chưa có dữ liệu')),
              const SizedBox(height: 24),
            ],
          ),
        ),
      );
    }

    final totalValue = provider.totalCurrentValue;
    final colors = [
      Colors.amber.shade700,
      Colors.orange.shade600,
      Colors.deepOrange.shade400,
      Colors.yellow.shade700,
      Colors.brown.shade400,
    ];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Tỷ lệ danh mục',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 200,
              child: PieChart(
                PieChartData(
                  sections: provider.holdings.asMap().entries.map((entry) {
                    final holding = entry.value;
                    final colorIndex = entry.key % colors.length;
                    final percentage = totalValue > 0
                        ? (holding.currentValue / totalValue) * 100
                        : 0.0;

                    return PieChartSectionData(
                      color: colors[colorIndex],
                      value: holding.currentValue,
                      title: '${percentage.toStringAsFixed(0)}%',
                      radius: 60,
                      titleStyle: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    );
                  }).toList(),
                  sectionsSpace: 2,
                  centerSpaceRadius: 40,
                ),
              ),
            ),
            const SizedBox(height: 16),
            // Legend
            Wrap(
              spacing: 16,
              runSpacing: 8,
              children: provider.holdings.asMap().entries.map((entry) {
                final holding = entry.value;
                final colorIndex = entry.key % colors.length;
                return Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: colors[colorIndex],
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      holding.goldType,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
}
