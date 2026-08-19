class CreditCard {
  final String id;
  final String name;
  final String? bankName;
  final String? last4; // 4 số cuối thẻ
  final double creditLimit;
  final int statementDay; // Ngày chốt sao kê (1-31)
  final int paymentDueDays; // Số ngày sau ngày chốt phải thanh toán
  final int alertDays; // Cảnh báo trước mấy ngày
  final String? note;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;

  // Calculated
  final double? currentDebt;
  final double? availableCredit;

  CreditCard({
    required this.id,
    required this.name,
    this.bankName,
    this.last4,
    this.creditLimit = 0,
    this.statementDay = 20,
    this.paymentDueDays = 10,
    this.alertDays = 3,
    this.note,
    this.isActive = true,
    DateTime? createdAt,
    DateTime? updatedAt,
    this.currentDebt,
    this.availableCredit,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  /// Ngày chốt sao kê tháng hiện tại
  DateTime get currentStatementDate {
    final now = DateTime.now();
    return DateTime(now.year, now.month, statementDay);
  }

  /// Hạn thanh toán
  DateTime get currentPaymentDueDate =>
      currentStatementDate.add(Duration(days: paymentDueDays));

  /// Kỳ sao kê hiện tại: từ ngày (statementDay+1) tháng trước đến ngày statementDay tháng này
  DateTime get statementPeriodStart {
    final now = DateTime.now();
    final thisMonthStmt = DateTime(now.year, now.month, statementDay);
    if (now.isAfter(thisMonthStmt)) {
      // Đã qua ngày sao kê tháng này -> kỳ mới
      return DateTime(now.year, now.month, statementDay + 1);
    } else {
      // Chưa qua ngày sao kê -> kỳ cũ
      return DateTime(now.year, now.month - 1, statementDay + 1);
    }
  }

  DateTime get statementPeriodEnd {
    final now = DateTime.now();
    final thisMonthStmt = DateTime(now.year, now.month, statementDay);
    if (now.isAfter(thisMonthStmt)) {
      return DateTime(now.year, now.month + 1, statementDay, 23, 59, 59);
    } else {
      return DateTime(now.year, now.month, statementDay, 23, 59, 59);
    }
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'bank_name': bankName,
      'last4': last4,
      'credit_limit': creditLimit,
      'statement_day': statementDay,
      'payment_due_days': paymentDueDays,
      'alert_days': alertDays,
      'note': note,
      'is_active': isActive ? 1 : 0,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  factory CreditCard.fromMap(Map<String, dynamic> map) {
    return CreditCard(
      id: map['id'] as String,
      name: map['name'] as String,
      bankName: map['bank_name'] as String?,
      last4: map['last4'] as String?,
      creditLimit: (map['credit_limit'] as num?)?.toDouble() ?? 0,
      statementDay: map['statement_day'] as int? ?? 20,
      paymentDueDays: map['payment_due_days'] as int? ?? 10,
      alertDays: map['alert_days'] as int? ?? 3,
      note: map['note'] as String?,
      isActive: (map['is_active'] as int? ?? 1) == 1,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
      currentDebt: (map['current_debt'] as num?)?.toDouble(),
      availableCredit: (map['available_credit'] as num?)?.toDouble(),
    );
  }

  CreditCard copyWith({
    String? id,
    String? name,
    String? bankName,
    String? last4,
    double? creditLimit,
    int? statementDay,
    int? paymentDueDays,
    int? alertDays,
    String? note,
    bool? isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return CreditCard(
      id: id ?? this.id,
      name: name ?? this.name,
      bankName: bankName ?? this.bankName,
      last4: last4 ?? this.last4,
      creditLimit: creditLimit ?? this.creditLimit,
      statementDay: statementDay ?? this.statementDay,
      paymentDueDays: paymentDueDays ?? this.paymentDueDays,
      alertDays: alertDays ?? this.alertDays,
      note: note ?? this.note,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

class CreditCardTransaction {
  final String id;
  final String cardId;
  final double amount;
  final String title;
  final String? note;
  final DateTime date;
  final String type; // 'expense', 'payment', 'installment'
  final int? installmentMonths; // Số tháng trả góp
  final int? installmentCurrent; // Tháng hiện tại
  final double? installmentMonthly; // Số tiền hàng tháng
  final bool isPaid;
  final DateTime createdAt;

  CreditCardTransaction({
    required this.id,
    required this.cardId,
    required this.amount,
    required this.title,
    this.note,
    required this.date,
    this.type = 'expense',
    this.installmentMonths,
    this.installmentCurrent,
    this.installmentMonthly,
    this.isPaid = false,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  bool get isInstallment => installmentMonths != null && installmentMonths! > 0;
  double get monthlyAmount => installmentMonthly ?? (isInstallment ? amount / installmentMonths! : amount);
  int get remainingMonths => isInstallment ? installmentMonths! - (installmentCurrent ?? 0) : 0;

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'card_id': cardId,
      'amount': amount,
      'title': title,
      'note': note,
      'date': date.toIso8601String(),
      'type': type,
      'installment_months': installmentMonths,
      'installment_current': installmentCurrent,
      'installment_monthly': installmentMonthly,
      'is_paid': isPaid ? 1 : 0,
      'created_at': createdAt.toIso8601String(),
    };
  }

  factory CreditCardTransaction.fromMap(Map<String, dynamic> map) {
    return CreditCardTransaction(
      id: map['id'] as String,
      cardId: map['card_id'] as String,
      amount: (map['amount'] as num?)?.toDouble() ?? 0,
      title: map['title'] as String,
      note: map['note'] as String?,
      date: DateTime.parse(map['date'] as String),
      type: map['type'] as String? ?? 'expense',
      installmentMonths: map['installment_months'] as int?,
      installmentCurrent: map['installment_current'] as int?,
      installmentMonthly: (map['installment_monthly'] as num?)?.toDouble(),
      isPaid: (map['is_paid'] as int? ?? 0) == 1,
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }
}
