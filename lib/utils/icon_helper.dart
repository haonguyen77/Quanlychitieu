import 'package:flutter/material.dart';

class IconHelper {
  static const Map<String, IconData> iconMap = {
    'wallet': Icons.account_balance_wallet,
    'food': Icons.restaurant,
    'coffee': Icons.coffee,
    'transport': Icons.directions_car,
    'shopping': Icons.shopping_bag,
    'health': Icons.medical_services,
    'education': Icons.school,
    'entertainment': Icons.movie,
    'bill': Icons.receipt_long,
    'home': Icons.home,
    'gift': Icons.card_giftcard,
    'salary': Icons.payments,
    'investment': Icons.trending_up,
    'phone': Icons.phone_android,
    'internet': Icons.wifi,
    'electric': Icons.bolt,
    'water': Icons.water_drop,
    'clothing': Icons.checkroom,
    'beauty': Icons.face,
    'pet': Icons.pets,
    'travel': Icons.flight,
    'sport': Icons.fitness_center,
    'bank': Icons.account_balance,
    'card': Icons.credit_card,
    'cash': Icons.money,
    'momo': Icons.phone_iphone,
    'shopee': Icons.store,
    'gold': Icons.diamond,
    'rent': Icons.apartment,
    'other': Icons.more_horiz,
    'add': Icons.add_circle_outline,
    'income': Icons.arrow_downward,
    'expense': Icons.arrow_upward,
  };

  static IconData getIcon(String? name) {
    if (name == null) return Icons.category;
    return iconMap[name] ?? Icons.category;
  }

  static List<String> get allIconNames => iconMap.keys.toList();
}
