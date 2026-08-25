import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:math';
import 'package:uuid/uuid.dart';
import '../../providers/module_provider.dart';
import '../../providers/transaction_provider.dart';
import '../../models/app_module.dart';
import '../../models/transaction.dart';
import '../../services/auto_sync.dart';
import '../../database/database_helper.dart';
import '../../utils/formatters.dart';
import '../../utils/icon_helper.dart';
import '../../utils/color_helper.dart';
import '../../modules/wine/screens/wine_home_screen.dart';
import '../../modules/wine/screens/products/wine_products_screen.dart';
import '../../modules/wine/screens/customers/wine_customers_screen.dart';
import '../../modules/wine/screens/inventory/wine_inventory_screen.dart';
import '../../modules/rental/screens/rental_home_screen.dart';
import '../../modules/gold/screens/gold_home_screen.dart';
import '../../modules/credit_card/screens/credit_card_screen.dart';
import '../../modules/shopee/screens/shopee_home_screen.dart';
import '../expense/expense_screen.dart';
import '../transactions/add_transaction_screen.dart';
import '../transactions/transaction_detail_screen.dart';

class ModulesTabScreen extends StatefulWidget {
  const ModulesTabScreen({super.key});

  @override
  State<ModulesTabScreen> createState() => _ModulesTabScreenState();
}

class _ModulesTabScreenState extends State<ModulesTabScreen> {
  static const _primaryPurple = Color(0xFF7B1FA2);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ModuleProvider>().loadModules();
    });
  }

  /// Add a new MODULE the Shopee way: the user just types a name, we assign a
  /// random color + default icon, and it immediately shows up here (Danh mục),
  /// in Settings → Quản lý Module (toggle on/off), and as a choice when adding
  /// an expense. The user can change the color/icon later in Quản lý Module.
  Future<void> _showAddCategoryDialog() async {
    final controller = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Thêm danh mục'),
        content: TextField(
          controller: controller,
          autofocus: true,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(
            hintText: 'Tên danh mục',
            border: OutlineInputBorder(),
          ),
          onSubmitted: (v) => Navigator.pop(ctx, v.trim()),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Thêm'),
          ),
        ],
      ),
    );

    if (name == null || name.isEmpty || !mounted) return;

    // Random color (Shopee-style) + default icon. Editable later in Quản lý Module.
    final randomColor = ColorHelper.availableColors[
        Random().nextInt(ColorHelper.availableColors.length)];
    final provider = context.read<ModuleProvider>();
    final maxSort = provider.modules.fold<int>(
        0, (m, e) => e.sortOrder > m ? e.sortOrder : m);
    final module = AppModule(
      id: 'mod_${const Uuid().v4().substring(0, 8)}',
      name: name,
      icon: 'other',
      color: ColorHelper.toHex(randomColor),
      sortOrder: maxSort + 1,
      isDefault: false,
      isActive: true,
    );

    await provider.addModule(module);
    // Persist the whole module list back to app_data.modules (source of truth),
    // so it survives reload and is included in sync.
    final modulesJson = provider.modules.map((m) => <String, dynamic>{
      'id': m.id,
      'name': m.name,
      'icon': m.icon,
      'color': m.color,
      'sortOrder': m.sortOrder,
      'isDefault': m.isDefault,
      'isActive': m.isActive,
      'isVisible': m.isActive,
    }).toList();
    await DatabaseHelper.instance.setAppData('modules', modulesJson);
    AutoSync.instance.notifyDataChanged();

    if (mounted) {
      setState(() {});
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Đã thêm module "$name"')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              child: Row(
                children: [
                  const Spacer(),
                  const Text('Danh mục', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF0F1F4D))),
                  const Spacer(),
                  GestureDetector(
                    onTap: _showAddCategoryDialog,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.add, size: 18, color: _primaryPurple),
                        const SizedBox(width: 4),
                        Text('Thêm danh mục', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: _primaryPurple)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // Module list
            Expanded(
              child: Consumer<ModuleProvider>(
                builder: (context, provider, child) {
                  if (provider.isLoading) return const Center(child: CircularProgressIndicator());
                  if (provider.modules.isEmpty) return const Center(child: Text('Chưa có module nào'));
                  // Only show active modules in navigation
                  final activeModules = provider.modules.where((m) => m.isActive).toList();
                  if (activeModules.isEmpty) return const Center(child: Text('Tất cả module đã tắt.\nVào Cài đặt → Quản lý Module để bật lại.'));
                  // Custom sort order: use module.sortOrder, then name as tiebreaker
                  final sorted = List.of(activeModules)..sort((a, b) {
                    final orderCmp = a.sortOrder.compareTo(b.sortOrder);
                    if (orderCmp != 0) return orderCmp;
                    return a.name.compareTo(b.name);
                  });
                  return ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: sorted.length,
                    itemBuilder: (context, index) => _ModuleCard(module: sorted[index]),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ModuleCard extends StatelessWidget {
  final AppModule module;
  const _ModuleCard({required this.module});

  @override
  Widget build(BuildContext context) {
    final color = _getModuleColor();
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 2)),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: () => _onTap(context),
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
            child: Row(
              children: [
                // Icon in colored circle
                Container(
                  width: 48, height: 48,
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(_getModuleIcon(), color: color, size: 24),
                ),
                const SizedBox(width: 16),
                // Name + description
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(module.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF0F1F4D))),
                      const SizedBox(height: 3),
                      Text(_getSubtitle(), style: TextStyle(fontSize: 13, color: Colors.grey[500])),
                    ],
                  ),
                ),
                // Arrow
                Icon(Icons.chevron_right, size: 22, color: Colors.grey[400]),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Color _getModuleColor() {
    switch (module.id) {
      case 'mod_chitieu': return const Color(0xFFEF3030); // Đỏ
      case 'mod_shopee': return const Color(0xFFFF5722); // Cam
      case 'mod_vang': return const Color(0xFFFFC107); // Vàng
      case 'mod_nhatro': return const Color(0xFF4CAF50); // Xanh lá
      case 'mod_ruou': return const Color(0xFF7B1FA2); // Tím
      case 'mod_ruou_products': return const Color(0xFF8E24AA); // Tím nhạt
      case 'mod_ruou_customers': return const Color(0xFF5C6BC0); // Xanh indigo
      case 'mod_ruou_inventory': return const Color(0xFF00897B); // Xanh ngọc
      case 'mod_creditcard': return const Color(0xFF1565C0); // Xanh dương
      default: return ColorHelper.getColor(module.color);
    }
  }

  IconData _getModuleIcon() {
    switch (module.id) {
      case 'mod_chitieu': return Icons.receipt_long;
      case 'mod_shopee': return Icons.shopping_bag;
      case 'mod_vang': return Icons.diamond;
      case 'mod_nhatro': return Icons.apartment;
      case 'mod_ruou': return Icons.liquor;
      case 'mod_ruou_products': return Icons.inventory_2;
      case 'mod_ruou_customers': return Icons.people;
      case 'mod_ruou_inventory': return Icons.warehouse;
      case 'mod_creditcard': return Icons.credit_card;
      default: return IconHelper.getIcon(module.icon);
    }
  }

  String _getSubtitle() {
    switch (module.id) {
      case 'mod_chitieu': return 'Chi tiêu hàng ngày';
      case 'mod_shopee': return 'Mua sắm online';
      case 'mod_vang': return 'Đầu tư vàng';
      case 'mod_nhatro': return 'Quản lý nhà trọ';
      case 'mod_ruou': return 'Quản lý kho rượu';
      case 'mod_creditcard': return 'Nhấn để xem giao dịch';
      default: return 'Nhấn để xem giao dịch';
    }
  }

  void _onTap(BuildContext context) {
    if (module.id == 'mod_chitieu') {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const ExpenseScreen()));
      return;
    }
    if (module.id == 'mod_ruou') {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const WineHomeScreen()));
      return;
    }
    if (module.id == 'mod_ruou_products') {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const WineProductsScreen()));
      return;
    }
    if (module.id == 'mod_ruou_customers') {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const WineCustomersScreen()));
      return;
    }
    if (module.id == 'mod_ruou_inventory') {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const WineInventoryScreen()));
      return;
    }
    if (module.id == 'mod_nhatro') {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const RentalHomeScreen()));
      return;
    }
    if (module.id == 'mod_vang') {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const GoldHomeScreen()));
      return;
    }
    if (module.id == 'mod_shopee') {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const ShopeeHomeScreen()));
      return;
    }
    if (module.id == 'mod_creditcard' || module.name.toLowerCase().contains('thẻ tín dụng') || module.name.toLowerCase().contains('credit')) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const CreditCardScreen()));
      return;
    }
    // Nhà trọ, Vàng: only month/year
    final monthYearOnly = module.id == 'mod_nhatro' || module.id == 'mod_vang';
    Navigator.push(context, MaterialPageRoute(
        builder: (_) => ModuleTransactionsScreen(module: module, monthYearOnly: monthYearOnly)));
  }
}

/// Screen showing transactions filtered by module with period navigation
class ModuleTransactionsScreen extends StatefulWidget {
  final AppModule module;
  final bool monthYearOnly;
  const ModuleTransactionsScreen({super.key, required this.module, this.monthYearOnly = false});

  @override
  State<ModuleTransactionsScreen> createState() => _ModuleTransactionsScreenState();
}

class _ModuleTransactionsScreenState extends State<ModuleTransactionsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<Transaction> _transactions = [];
  bool _isLoading = true;

  // Current selected period for navigation
  DateTime _selectedDate = DateTime.now();

  List<String> get _tabLabels =>
      widget.monthYearOnly ? ['Tháng', 'Năm'] : ['Ngày', 'Tuần', 'Tháng', 'Năm'];

  int get _defaultTab => widget.monthYearOnly ? 0 : 2; // default to Tháng

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabLabels.length, vsync: this, initialIndex: _defaultTab);
    _tabController.addListener(_onTabChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadTransactions());
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _onTabChanged() {
    if (!_tabController.indexIsChanging) _loadTransactions();
  }

  String get _periodLabel {
    final d = _selectedDate;
    if (widget.monthYearOnly) {
      return _tabController.index == 0
          ? 'Tháng ${d.month}/${d.year}'
          : 'Năm ${d.year}';
    }
    switch (_tabController.index) {
      case 0: return Formatters.date(d);
      case 1: return 'Tuần ${_weekNumber(d)}/${d.year}';
      case 2: return 'Tháng ${d.month}/${d.year}';
      case 3: return 'Năm ${d.year}';
      default: return '';
    }
  }

  int _weekNumber(DateTime date) {
    final firstDay = DateTime(date.year, 1, 1);
    return ((date.difference(firstDay).inDays + firstDay.weekday) / 7).ceil();
  }

  Future<void> _loadTransactions() async {
    setState(() => _isLoading = true);

    final d = _selectedDate;
    DateTime start;
    DateTime end;

    if (widget.monthYearOnly) {
      if (_tabController.index == 0) {
        start = DateTime(d.year, d.month, 1);
        end = DateTime(d.year, d.month + 1, 1);
      } else {
        start = DateTime(d.year, 1, 1);
        end = DateTime(d.year + 1, 1, 1);
      }
    } else {
      switch (_tabController.index) {
        case 0: // Ngày
          start = DateTime(d.year, d.month, d.day);
          end = DateTime(d.year, d.month, d.day + 1);
          break;
        case 1: // Tuần
          final weekStart = d.subtract(Duration(days: d.weekday - 1));
          start = DateTime(weekStart.year, weekStart.month, weekStart.day);
          end = start.add(const Duration(days: 7));
          break;
        case 2: // Tháng
          start = DateTime(d.year, d.month, 1);
          end = DateTime(d.year, d.month + 1, 1);
          break;
        case 3: // Năm
          start = DateTime(d.year, 1, 1);
          end = DateTime(d.year + 1, 1, 1);
          break;
        default:
          start = DateTime(d.year, d.month, 1);
          end = DateTime(d.year, d.month + 1, 1);
      }
    }

    final provider = context.read<TransactionProvider>();
    // Each module shows ONLY its own transactions (including Chi tiêu)
    final results = await provider.search(moduleId: widget.module.id, startDate: start, endDate: end);
    setState(() { _transactions = results; _isLoading = false; });
  }

  void _navigatePeriod(int direction) {
    setState(() {
      if (widget.monthYearOnly) {
        if (_tabController.index == 0) {
          _selectedDate = DateTime(_selectedDate.year, _selectedDate.month + direction, 1);
        } else {
          _selectedDate = DateTime(_selectedDate.year + direction, _selectedDate.month, 1);
        }
      } else {
        switch (_tabController.index) {
          case 0: _selectedDate = _selectedDate.add(Duration(days: direction)); break;
          case 1: _selectedDate = _selectedDate.add(Duration(days: 7 * direction)); break;
          case 2: _selectedDate = DateTime(_selectedDate.year, _selectedDate.month + direction, 1); break;
          case 3: _selectedDate = DateTime(_selectedDate.year + direction, 1, 1); break;
        }
      }
    });
    _loadTransactions();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
      _loadTransactions();
    }
  }

  double get _totalExpense => _transactions.where((t) => t.isExpense).fold(0.0, (sum, t) => sum + t.amount);
  double get _totalIncome => _transactions.where((t) => t.isIncome).fold(0.0, (sum, t) => sum + t.amount);

  @override
  Widget build(BuildContext context) {
    final color = ColorHelper.getColor(widget.module.color);

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.module.name),
        bottom: TabBar(
          controller: _tabController,
          tabs: [for (final label in _tabLabels) Tab(text: label)],
        ),
      ),
      body: Column(
        children: [
          // Period navigator
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            color: color.withValues(alpha: 0.03),
            child: Row(
              children: [
                IconButton(icon: const Icon(Icons.chevron_left), onPressed: () => _navigatePeriod(-1)),
                Expanded(
                  child: GestureDetector(
                    onTap: _pickDate,
                    child: Text(_periodLabel,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                  ),
                ),
                IconButton(icon: const Icon(Icons.chevron_right), onPressed: () => _navigatePeriod(1)),
              ],
            ),
          ),
          // Summary
          Container(
            padding: const EdgeInsets.all(12),
            color: color.withValues(alpha: 0.05),
            child: Row(
              children: [
                Expanded(child: Column(children: [
                  Text('Chi', style: Theme.of(context).textTheme.bodySmall),
                  Text(Formatters.currencyCompact(_totalExpense), style: Theme.of(context).textTheme.titleSmall?.copyWith(color: Theme.of(context).colorScheme.error, fontWeight: FontWeight.bold)),
                ])),
                Expanded(child: Column(children: [
                  Text('Thu', style: Theme.of(context).textTheme.bodySmall),
                  Text(Formatters.currencyCompact(_totalIncome), style: Theme.of(context).textTheme.titleSmall?.copyWith(color: Colors.green, fontWeight: FontWeight.bold)),
                ])),
                Expanded(child: Column(children: [
                  Text('Tổng', style: Theme.of(context).textTheme.bodySmall),
                  Text(Formatters.currencyCompact(_totalIncome - _totalExpense), style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
                ])),
              ],
            ),
          ),
          // Transactions list
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _transactions.isEmpty
                    ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Icon(Icons.receipt_long_outlined, size: 48, color: Theme.of(context).colorScheme.outline),
                        const SizedBox(height: 12),
                        Text('Chưa có giao dịch', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.outline)),
                      ]))
                    : ListView.builder(
                        itemCount: _transactions.length,
                        itemBuilder: (context, index) {
                          final t = _transactions[index];
                          return ListTile(
                            leading: CircleAvatar(
                              radius: 18,
                              backgroundColor: (t.isExpense ? Theme.of(context).colorScheme.error : Colors.green).withValues(alpha: 0.1),
                              child: Icon(t.isExpense ? Icons.arrow_upward : Icons.arrow_downward, size: 16,
                                  color: t.isExpense ? Theme.of(context).colorScheme.error : Colors.green),
                            ),
                            title: Text(t.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                            subtitle: Text('${t.categoryName ?? ''} • ${Formatters.relativeDate(t.date)}', style: Theme.of(context).textTheme.bodySmall),
                            trailing: Text('${t.isExpense ? '-' : '+'}${Formatters.currency(t.amount)}',
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: t.isExpense ? Theme.of(context).colorScheme.error : Colors.green, fontWeight: FontWeight.w600)),
                            onTap: () async {
                              final result = await Navigator.push(context, MaterialPageRoute(
                                builder: (_) => TransactionDetailScreen(transaction: t),
                              ));
                              if (result == true) _loadTransactions();
                            },
                          );
                        },
                      ),
          ),
        ],
      ),
      // FAB to add transaction pre-selected to this module
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          await Navigator.push(context, MaterialPageRoute(
            builder: (_) => AddTransactionScreen(preSelectedModuleId: widget.module.id),
          ));
          _loadTransactions();
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
