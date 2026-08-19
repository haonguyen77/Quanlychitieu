class Budget {
  final String id;
  final String name;
  final double amount;
  final String? categoryId;
  final String? moduleId;
  final String period; // monthly, weekly, yearly
  final String? startDate;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;

  // Calculated fields
  final double? spent;

  Budget({
    required this.id,
    required this.name,
    required this.amount,
    this.categoryId,
    this.moduleId,
    this.period = 'monthly',
    this.startDate,
    this.isActive = true,
    DateTime? createdAt,
    DateTime? updatedAt,
    this.spent,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  double get remaining => amount - (spent ?? 0);
  double get percentage => amount > 0 ? ((spent ?? 0) / amount) * 100 : 0;
  bool get isOverBudget => (spent ?? 0) > amount;
  bool get isNearLimit => percentage >= 80 && !isOverBudget;

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'amount': amount,
      'category_id': categoryId,
      'module_id': moduleId,
      'period': period,
      'start_date': startDate,
      'is_active': isActive ? 1 : 0,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  factory Budget.fromMap(Map<String, dynamic> map) {
    return Budget(
      id: map['id'] as String,
      name: map['name'] as String,
      amount: (map['amount'] as num?)?.toDouble() ?? 0,
      categoryId: map['category_id'] as String?,
      moduleId: map['module_id'] as String?,
      period: map['period'] as String? ?? 'monthly',
      startDate: map['start_date'] as String?,
      isActive: (map['is_active'] as int? ?? 1) == 1,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
      spent: (map['spent'] as num?)?.toDouble(),
    );
  }

  Budget copyWith({
    String? id,
    String? name,
    double? amount,
    String? categoryId,
    String? moduleId,
    String? period,
    String? startDate,
    bool? isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
    double? spent,
  }) {
    return Budget(
      id: id ?? this.id,
      name: name ?? this.name,
      amount: amount ?? this.amount,
      categoryId: categoryId ?? this.categoryId,
      moduleId: moduleId ?? this.moduleId,
      period: period ?? this.period,
      startDate: startDate ?? this.startDate,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      spent: spent ?? this.spent,
    );
  }
}
