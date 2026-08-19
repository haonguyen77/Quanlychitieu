class RecurringTransaction {
  final String id;
  final int type; // 0 = expense, 1 = income
  final double amount;
  final String title;
  final String? note;
  final String? categoryId;
  final String? accountId;
  final String? moduleId;
  final String frequency; // daily, weekly, monthly, yearly
  final DateTime nextDate;
  final bool isAuto; // auto-create or just remind
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;

  RecurringTransaction({
    required this.id,
    required this.type,
    required this.amount,
    required this.title,
    this.note,
    this.categoryId,
    this.accountId,
    this.moduleId,
    this.frequency = 'monthly',
    required this.nextDate,
    this.isAuto = false,
    this.isActive = true,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'type': type,
      'amount': amount,
      'title': title,
      'note': note,
      'category_id': categoryId,
      'account_id': accountId,
      'module_id': moduleId,
      'frequency': frequency,
      'next_date': nextDate.toIso8601String(),
      'is_auto': isAuto ? 1 : 0,
      'is_active': isActive ? 1 : 0,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  factory RecurringTransaction.fromMap(Map<String, dynamic> map) {
    return RecurringTransaction(
      id: map['id'] as String,
      type: map['type'] as int? ?? 0,
      amount: (map['amount'] as num?)?.toDouble() ?? 0,
      title: map['title'] as String,
      note: map['note'] as String?,
      categoryId: map['category_id'] as String?,
      accountId: map['account_id'] as String?,
      moduleId: map['module_id'] as String?,
      frequency: map['frequency'] as String? ?? 'monthly',
      nextDate: DateTime.parse(map['next_date'] as String),
      isAuto: (map['is_auto'] as int? ?? 0) == 1,
      isActive: (map['is_active'] as int? ?? 1) == 1,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
    );
  }

  RecurringTransaction copyWith({
    String? id,
    int? type,
    double? amount,
    String? title,
    String? note,
    String? categoryId,
    String? accountId,
    String? moduleId,
    String? frequency,
    DateTime? nextDate,
    bool? isAuto,
    bool? isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return RecurringTransaction(
      id: id ?? this.id,
      type: type ?? this.type,
      amount: amount ?? this.amount,
      title: title ?? this.title,
      note: note ?? this.note,
      categoryId: categoryId ?? this.categoryId,
      accountId: accountId ?? this.accountId,
      moduleId: moduleId ?? this.moduleId,
      frequency: frequency ?? this.frequency,
      nextDate: nextDate ?? this.nextDate,
      isAuto: isAuto ?? this.isAuto,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
