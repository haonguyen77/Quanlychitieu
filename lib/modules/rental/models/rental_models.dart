class RentalRoom {
  final String id;
  final String name;
  final double rentAmount;
  final String? note;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;

  // Computed - populated by provider
  final String? currentTenantName;
  final bool isOccupied;

  RentalRoom({
    required this.id,
    required this.name,
    this.rentAmount = 0,
    this.note,
    this.isActive = true,
    required this.createdAt,
    required this.updatedAt,
    this.currentTenantName,
    this.isOccupied = false,
  });

  factory RentalRoom.fromMap(Map<String, dynamic> map) {
    return RentalRoom(
      id: map['id'] as String,
      name: map['name'] as String,
      rentAmount: (map['rent_amount'] as num?)?.toDouble() ?? 0,
      note: map['note'] as String?,
      isActive: (map['is_active'] as int?) == 1,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
      currentTenantName: map['tenant_name'] as String?,
      isOccupied: map['tenant_name'] != null,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'rent_amount': rentAmount,
      'note': note,
      'is_active': isActive ? 1 : 0,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  RentalRoom copyWith({
    String? id,
    String? name,
    double? rentAmount,
    String? note,
    bool? isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? currentTenantName,
    bool? isOccupied,
  }) {
    return RentalRoom(
      id: id ?? this.id,
      name: name ?? this.name,
      rentAmount: rentAmount ?? this.rentAmount,
      note: note ?? this.note,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      currentTenantName: currentTenantName ?? this.currentTenantName,
      isOccupied: isOccupied ?? this.isOccupied,
    );
  }
}

class RentalTenant {
  final String id;
  final String? roomId;
  final String name;
  final String? phone;
  final String? idNumber;
  final DateTime? moveInDate;
  final DateTime? moveOutDate;
  final double deposit;
  final bool isActive;
  final String? note;
  final DateTime createdAt;
  final DateTime updatedAt;

  // Computed
  final String? roomName;

  RentalTenant({
    required this.id,
    this.roomId,
    required this.name,
    this.phone,
    this.idNumber,
    this.moveInDate,
    this.moveOutDate,
    this.deposit = 0,
    this.isActive = true,
    this.note,
    required this.createdAt,
    required this.updatedAt,
    this.roomName,
  });

  factory RentalTenant.fromMap(Map<String, dynamic> map) {
    return RentalTenant(
      id: map['id'] as String,
      roomId: map['room_id'] as String?,
      name: map['name'] as String,
      phone: map['phone'] as String?,
      idNumber: map['id_number'] as String?,
      moveInDate: map['move_in_date'] != null ? DateTime.parse(map['move_in_date'] as String) : null,
      moveOutDate: map['move_out_date'] != null ? DateTime.parse(map['move_out_date'] as String) : null,
      deposit: (map['deposit'] as num?)?.toDouble() ?? 0,
      isActive: (map['is_active'] as int?) == 1,
      note: map['note'] as String?,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
      roomName: map['room_name'] as String?,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'room_id': roomId,
      'name': name,
      'phone': phone,
      'id_number': idNumber,
      'move_in_date': moveInDate?.toIso8601String(),
      'move_out_date': moveOutDate?.toIso8601String(),
      'deposit': deposit,
      'is_active': isActive ? 1 : 0,
      'note': note,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  RentalTenant copyWith({
    String? id,
    String? roomId,
    String? name,
    String? phone,
    String? idNumber,
    DateTime? moveInDate,
    DateTime? moveOutDate,
    double? deposit,
    bool? isActive,
    String? note,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? roomName,
  }) {
    return RentalTenant(
      id: id ?? this.id,
      roomId: roomId ?? this.roomId,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      idNumber: idNumber ?? this.idNumber,
      moveInDate: moveInDate ?? this.moveInDate,
      moveOutDate: moveOutDate ?? this.moveOutDate,
      deposit: deposit ?? this.deposit,
      isActive: isActive ?? this.isActive,
      note: note ?? this.note,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      roomName: roomName ?? this.roomName,
    );
  }
}

class RentalMonthlyBill {
  final String id;
  final String roomId;
  final String? tenantId;
  final int year;
  final int month;
  final double rentAmount;
  final int electricityOld;
  final int electricityNew;
  final double electricityPrice;
  final double electricityAmount;
  final double waterAmount;
  final double internetAmount;
  final double otherAmount;
  final String? otherNote;
  final double totalAmount;
  final String paymentStatus; // unpaid, paid, overdue
  final DateTime? paidDate;
  final String? note;
  final DateTime createdAt;
  final DateTime updatedAt;

  // Computed
  final String? roomName;
  final String? tenantName;

  RentalMonthlyBill({
    required this.id,
    required this.roomId,
    this.tenantId,
    required this.year,
    required this.month,
    this.rentAmount = 0,
    this.electricityOld = 0,
    this.electricityNew = 0,
    this.electricityPrice = 3500,
    this.electricityAmount = 0,
    this.waterAmount = 0,
    this.internetAmount = 0,
    this.otherAmount = 0,
    this.otherNote,
    this.totalAmount = 0,
    this.paymentStatus = 'unpaid',
    this.paidDate,
    this.note,
    required this.createdAt,
    required this.updatedAt,
    this.roomName,
    this.tenantName,
  });

  int get electricityUsage => electricityNew - electricityOld;

  factory RentalMonthlyBill.fromMap(Map<String, dynamic> map) {
    return RentalMonthlyBill(
      id: map['id'] as String,
      roomId: map['room_id'] as String,
      tenantId: map['tenant_id'] as String?,
      year: map['year'] as int,
      month: map['month'] as int,
      rentAmount: (map['rent_amount'] as num?)?.toDouble() ?? 0,
      electricityOld: (map['electricity_old'] as int?) ?? 0,
      electricityNew: (map['electricity_new'] as int?) ?? 0,
      electricityPrice: (map['electricity_price'] as num?)?.toDouble() ?? 3500,
      electricityAmount: (map['electricity_amount'] as num?)?.toDouble() ?? 0,
      waterAmount: (map['water_amount'] as num?)?.toDouble() ?? 0,
      internetAmount: (map['internet_amount'] as num?)?.toDouble() ?? 0,
      otherAmount: (map['other_amount'] as num?)?.toDouble() ?? 0,
      otherNote: map['other_note'] as String?,
      totalAmount: (map['total_amount'] as num?)?.toDouble() ?? 0,
      paymentStatus: (map['payment_status'] as String?) ?? 'unpaid',
      paidDate: map['paid_date'] != null ? DateTime.parse(map['paid_date'] as String) : null,
      note: map['note'] as String?,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
      roomName: map['room_name'] as String?,
      tenantName: map['tenant_name'] as String?,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'room_id': roomId,
      'tenant_id': tenantId,
      'year': year,
      'month': month,
      'rent_amount': rentAmount,
      'electricity_old': electricityOld,
      'electricity_new': electricityNew,
      'electricity_price': electricityPrice,
      'electricity_amount': electricityAmount,
      'water_amount': waterAmount,
      'internet_amount': internetAmount,
      'other_amount': otherAmount,
      'other_note': otherNote,
      'total_amount': totalAmount,
      'payment_status': paymentStatus,
      'paid_date': paidDate?.toIso8601String(),
      'note': note,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  RentalMonthlyBill copyWith({
    String? id,
    String? roomId,
    String? tenantId,
    int? year,
    int? month,
    double? rentAmount,
    int? electricityOld,
    int? electricityNew,
    double? electricityPrice,
    double? electricityAmount,
    double? waterAmount,
    double? internetAmount,
    double? otherAmount,
    String? otherNote,
    double? totalAmount,
    String? paymentStatus,
    DateTime? paidDate,
    String? note,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? roomName,
    String? tenantName,
  }) {
    return RentalMonthlyBill(
      id: id ?? this.id,
      roomId: roomId ?? this.roomId,
      tenantId: tenantId ?? this.tenantId,
      year: year ?? this.year,
      month: month ?? this.month,
      rentAmount: rentAmount ?? this.rentAmount,
      electricityOld: electricityOld ?? this.electricityOld,
      electricityNew: electricityNew ?? this.electricityNew,
      electricityPrice: electricityPrice ?? this.electricityPrice,
      electricityAmount: electricityAmount ?? this.electricityAmount,
      waterAmount: waterAmount ?? this.waterAmount,
      internetAmount: internetAmount ?? this.internetAmount,
      otherAmount: otherAmount ?? this.otherAmount,
      otherNote: otherNote ?? this.otherNote,
      totalAmount: totalAmount ?? this.totalAmount,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      paidDate: paidDate ?? this.paidDate,
      note: note ?? this.note,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      roomName: roomName ?? this.roomName,
      tenantName: tenantName ?? this.tenantName,
    );
  }
}
