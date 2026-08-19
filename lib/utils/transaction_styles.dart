import 'package:flutter/material.dart';

/// Shared color/icon definitions for modules, payment methods, and categories.
/// Used by both ExpenseScreen and AddTransactionScreen to ensure consistency.

class TransactionStyles {
  TransactionStyles._();

  // ─── Module Colors ────────────────────────────────────────────────────

  static Color moduleColor(String? moduleId) {
    switch (moduleId) {
      case 'mod_chitieu': return const Color(0xFF1264F5); // xanh nước biển
      case 'mod_shopee': return const Color(0xFFFF5722); // cam
      case 'mod_vang': return const Color(0xFFFFC107); // vàng
      case 'mod_nhatro': return const Color(0xFF4CAF50); // xanh lá
      default: return Colors.grey;
    }
  }

  static Color moduleColorByName(String? name) {
    switch (name) {
      case 'Chi tiêu': return const Color(0xFF1264F5);
      case 'Shopee': return const Color(0xFFFF5722);
      case 'Vàng': return const Color(0xFFFFC107);
      case 'Nhà trọ': return const Color(0xFF4CAF50);
      case 'Rượu': return const Color(0xFF7B1FA2);
      case 'Thẻ tín dụng': return const Color(0xFF1565C0);
      default: return Colors.grey;
    }
  }

  static IconData moduleIconByName(String? name) {
    switch (name) {
      case 'Chi tiêu': return Icons.receipt_long;
      case 'Shopee': return Icons.store;
      case 'Vàng': return Icons.diamond;
      case 'Nhà trọ': return Icons.apartment;
      case 'Rượu': return Icons.liquor;
      case 'Thẻ tín dụng': return Icons.credit_card;
      default: return Icons.widgets;
    }
  }

  static IconData moduleIcon(String? iconName) {
    switch (iconName) {
      case 'expense': return Icons.receipt_long;
      case 'shopee': return Icons.shopping_cart;
      case 'gold': return Icons.diamond;
      case 'rent': return Icons.home;
      case 'card': return Icons.credit_card;
      default: return Icons.widgets;
    }
  }

  // ─── Payment Method (Account) Colors ──────────────────────────────────

  static Color accountColor(String? iconName) {
    switch (iconName) {
      case 'cash': return const Color(0xFF4CAF50);
      case 'card': return const Color(0xFF1A237E);
      case 'bank': return const Color(0xFF1B5E20);
      case 'momo': return const Color(0xFFD81B60);
      case 'wallet': return const Color(0xFF2196F3);
      default: return Colors.blueGrey;
    }
  }

  static Color accountColorByName(String? name) {
    switch (name) {
      case 'Tiền mặt': return const Color(0xFF4CAF50);
      case 'Thẻ tín dụng': return const Color(0xFF1A237E);
      case 'Vietcombank': return const Color(0xFF1B5E20);
      case 'MoMo': return const Color(0xFFD81B60);
      case 'Ví điện tử': return const Color(0xFF2196F3);
      case 'Chuyển khoản': return const Color(0xFF0288D1);
      default: return Colors.blueGrey;
    }
  }

  static IconData accountIcon(String? iconName) {
    switch (iconName) {
      case 'cash': return Icons.payments;
      case 'card': return Icons.credit_card;
      case 'bank': return Icons.account_balance;
      case 'momo': return Icons.phone_android;
      case 'wallet': return Icons.account_balance_wallet;
      default: return Icons.more_horiz;
    }
  }

  static IconData accountIconByName(String? name) {
    switch (name) {
      case 'Tiền mặt': return Icons.payments;
      case 'Thẻ tín dụng': return Icons.credit_card;
      case 'Vietcombank': return Icons.account_balance;
      case 'MoMo': return Icons.phone_android;
      case 'Ví điện tử': return Icons.account_balance_wallet;
      case 'Chuyển khoản': return Icons.swap_horiz;
      default: return Icons.account_balance_wallet;
    }
  }

  // ─── Category Colors ──────────────────────────────────────────────────

  static IconData categoryIcon(String? iconName) {
    switch (iconName) {
      case 'food': return Icons.restaurant;
      case 'transport': return Icons.directions_car;
      case 'shopping': return Icons.shopping_bag;
      case 'health': return Icons.favorite;
      case 'entertainment': return Icons.sports_esports;
      case 'bill': return Icons.receipt_long;
      case 'education': return Icons.school;
      case 'rent': return Icons.home;
      case 'gift': return Icons.card_giftcard;
      case 'salary': return Icons.account_balance_wallet;
      case 'income': return Icons.trending_up;
      case 'coffee': return Icons.coffee;
      case 'other': return Icons.more_horiz;
      default: return Icons.category;
    }
  }

  /// Get category icon and color by category display name
  static ({IconData icon, Color color, Color bgColor}) categoryByName(String? name) {
    switch (name) {
      case 'Ăn uống': return (icon: Icons.restaurant, color: Colors.orange, bgColor: Colors.orange[50]!);
      case 'Di chuyển': return (icon: Icons.directions_car, color: Colors.blue, bgColor: Colors.blue[50]!);
      case 'Mua sắm': return (icon: Icons.shopping_bag, color: Colors.pink, bgColor: Colors.pink[50]!);
      case 'Sức khỏe': return (icon: Icons.favorite, color: Colors.red, bgColor: Colors.red[50]!);
      case 'Giải trí': return (icon: Icons.sports_esports, color: Colors.purple, bgColor: Colors.purple[50]!);
      case 'Hóa đơn': return (icon: Icons.receipt_long, color: Colors.blueGrey, bgColor: Colors.blueGrey[50]!);
      case 'Giáo dục': return (icon: Icons.school, color: Colors.indigo, bgColor: Colors.indigo[50]!);
      case 'Nhà ở': return (icon: Icons.home, color: Colors.teal, bgColor: Colors.teal[50]!);
      case 'Nhà trọ': return (icon: Icons.home, color: Colors.teal, bgColor: Colors.teal[50]!);
      case 'Khác': return (icon: Icons.more_horiz, color: Colors.grey, bgColor: Colors.grey[100]!);
      case 'Lương': return (icon: Icons.account_balance_wallet, color: Colors.green, bgColor: Colors.green[50]!);
      case 'Thưởng': return (icon: Icons.card_giftcard, color: Colors.amber, bgColor: Colors.amber[50]!);
      case 'Thu khác': return (icon: Icons.trending_up, color: Colors.cyan, bgColor: Colors.cyan[50]!);
      default: return (icon: Icons.attach_money, color: Colors.grey, bgColor: Colors.grey[100]!);
    }
  }

  static Color parseColor(String colorStr) {
    try {
      final hex = colorStr.replaceAll('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    } catch (_) {
      return Colors.blue;
    }
  }
}
