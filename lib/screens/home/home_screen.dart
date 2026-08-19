import 'package:flutter/material.dart';
import '../dashboard/dashboard_screen.dart';
import '../expense/expense_screen.dart';
import '../modules/modules_tab_screen.dart';
import '../settings/settings_screen.dart';
import '../transactions/add_transaction_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 1; // Default to Chi tiêu tab

  final _expenseKey = GlobalKey<State<StatefulWidget>>();

  List<Widget> get _screens => [
    const DashboardScreen(),
    ExpenseScreen(key: _expenseKey),
    const SizedBox(), // Placeholder for FAB (center button)
    const ModulesTabScreen(),
    const SettingsScreen(),
  ];

  void _onTabTapped(int index) {
    if (index == 2) {
      // Center "+" button - open add transaction
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => const AddTransactionScreen(),
        ),
      ).then((_) {
        // Trigger reload on ExpenseScreen after adding transaction
        final state = _expenseKey.currentState;
        if (state != null && state is dynamic) {
          try { (state as dynamic).reloadData(); } catch (_) {}
        }
      });
      return;
    }
    setState(() {
      _currentIndex = index;
    });
    // Reload ExpenseScreen when switching to Chi tiêu tab
    if (index == 1) {
      try { (_expenseKey.currentState as dynamic)?.reloadData(); } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: _buildBottomNavBar(),
      extendBody: true,
    );
  }

  Widget _buildBottomNavBar() {
    const navyBlue = Color(0xFF1264F5);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: SizedBox(
          height: 64,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(
                index: 0,
                icon: Icons.bar_chart_outlined,
                activeIcon: Icons.bar_chart,
                label: 'Dashboard',
              ),
              _buildNavItem(
                index: 1,
                icon: Icons.receipt_long_outlined,
                activeIcon: Icons.receipt_long,
                label: 'Chi tiêu',
              ),
              // Center FAB button
              GestureDetector(
                onTap: () => _onTabTapped(2),
                child: Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: navyBlue,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: navyBlue.withOpacity(0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.add,
                    color: Colors.white,
                    size: 28,
                  ),
                ),
              ),
              _buildNavItem(
                index: 3,
                icon: Icons.category_outlined,
                activeIcon: Icons.category,
                label: 'Danh mục',
              ),
              _buildNavItem(
                index: 4,
                icon: Icons.settings_outlined,
                activeIcon: Icons.settings,
                label: 'Cài đặt',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({
    required int index,
    required IconData icon,
    required IconData activeIcon,
    required String label,
  }) {
    final isSelected = _currentIndex == index;
    const navyBlue = Color(0xFF1264F5);
    final color = isSelected ? navyBlue : Colors.grey;

    return GestureDetector(
      onTap: () => _onTabTapped(index),
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 64,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isSelected ? activeIcon : icon,
              color: color,
              size: 24,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: color,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
