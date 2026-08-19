class Account {
  final String id;
  final String name;
  final String icon;
  final String color;
  final double initialBalance;
  final double currentBalance;
  final bool includeInTotal;
  final bool isActive;
  final int sortOrder;
  final DateTime createdAt;
  final DateTime updatedAt;

  Account({
    required this.id,
    required this.name,
    this.icon = 'wallet',
    this.color = '#2196F3',
    this.initialBalance = 0,
    this.currentBalance = 0,
    this.includeInTotal = true,
    this.isActive = true,
    this.sortOrder = 0,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'icon': icon,
      'color': color,
      'initial_balance': initialBalance,
      'current_balance': currentBalance,
      'include_in_total': includeInTotal ? 1 : 0,
      'is_active': isActive ? 1 : 0,
      'sort_order': sortOrder,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  factory Account.fromMap(Map<String, dynamic> map) {
    return Account(
      id: map['id'] as String,
      name: map['name'] as String,
      icon: map['icon'] as String? ?? 'wallet',
      color: map['color'] as String? ?? '#2196F3',
      initialBalance: (map['initial_balance'] as num?)?.toDouble() ?? 0,
      currentBalance: (map['current_balance'] as num?)?.toDouble() ?? 0,
      includeInTotal: (map['include_in_total'] as int? ?? 1) == 1,
      isActive: (map['is_active'] as int? ?? 1) == 1,
      sortOrder: map['sort_order'] as int? ?? 0,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
    );
  }

  Account copyWith({
    String? id,
    String? name,
    String? icon,
    String? color,
    double? initialBalance,
    double? currentBalance,
    bool? includeInTotal,
    bool? isActive,
    int? sortOrder,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Account(
      id: id ?? this.id,
      name: name ?? this.name,
      icon: icon ?? this.icon,
      color: color ?? this.color,
      initialBalance: initialBalance ?? this.initialBalance,
      currentBalance: currentBalance ?? this.currentBalance,
      includeInTotal: includeInTotal ?? this.includeInTotal,
      isActive: isActive ?? this.isActive,
      sortOrder: sortOrder ?? this.sortOrder,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
