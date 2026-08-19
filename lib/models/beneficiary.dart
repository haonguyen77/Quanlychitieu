class Beneficiary {
  final String id;
  final String name;
  final bool isActive;
  final int sortOrder;
  final DateTime createdAt;
  final DateTime updatedAt;

  Beneficiary({
    required this.id,
    required this.name,
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
      'is_active': isActive ? 1 : 0,
      'sort_order': sortOrder,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  factory Beneficiary.fromMap(Map<String, dynamic> map) {
    return Beneficiary(
      id: map['id'] as String,
      name: map['name'] as String,
      isActive: (map['is_active'] as int? ?? 1) == 1,
      sortOrder: map['sort_order'] as int? ?? 0,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
    );
  }

  Beneficiary copyWith({
    String? id,
    String? name,
    bool? isActive,
    int? sortOrder,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Beneficiary(
      id: id ?? this.id,
      name: name ?? this.name,
      isActive: isActive ?? this.isActive,
      sortOrder: sortOrder ?? this.sortOrder,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
