class WineCustomer {
  final String id;
  final String name;
  final String? phone;
  final String? address;
  final String? district;
  final String? city;
  final String? note;
  final int totalOrders;
  final String? lastOrderDate;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;

  // Calculated (from queries)
  final double? totalSpent;

  WineCustomer({
    required this.id,
    required this.name,
    this.phone,
    this.address,
    this.district,
    this.city,
    this.note,
    this.totalOrders = 0,
    this.lastOrderDate,
    this.isActive = true,
    DateTime? createdAt,
    DateTime? updatedAt,
    this.totalSpent,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'phone': phone,
      'address': address,
      'district': district,
      'city': city,
      'note': note,
      'total_orders': totalOrders,
      'last_order_date': lastOrderDate,
      'is_active': isActive ? 1 : 0,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  factory WineCustomer.fromMap(Map<String, dynamic> map) {
    return WineCustomer(
      id: map['id'] as String,
      name: map['name'] as String,
      phone: map['phone'] as String?,
      address: map['address'] as String?,
      district: map['district'] as String?,
      city: map['city'] as String?,
      note: map['note'] as String?,
      totalOrders: map['total_orders'] as int? ?? 0,
      lastOrderDate: map['last_order_date'] as String?,
      isActive: (map['is_active'] as int? ?? 1) == 1,
      createdAt: DateTime.tryParse(map['created_at'] as String? ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(map['updated_at'] as String? ?? '') ?? DateTime.now(),
      totalSpent: (map['total_spent'] as num?)?.toDouble(),
    );
  }

  WineCustomer copyWith({
    String? id,
    String? name,
    String? phone,
    String? address,
    String? district,
    String? city,
    String? note,
    int? totalOrders,
    String? lastOrderDate,
    bool? isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return WineCustomer(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      address: address ?? this.address,
      district: district ?? this.district,
      city: city ?? this.city,
      note: note ?? this.note,
      totalOrders: totalOrders ?? this.totalOrders,
      lastOrderDate: lastOrderDate ?? this.lastOrderDate,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
