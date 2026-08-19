class Transfer {
  final String id;
  final String fromAccountId;
  final String toAccountId;
  final double amount;
  final String? note;
  final DateTime date;
  final DateTime createdAt;

  // Joined fields
  final String? fromAccountName;
  final String? toAccountName;

  Transfer({
    required this.id,
    required this.fromAccountId,
    required this.toAccountId,
    required this.amount,
    this.note,
    required this.date,
    DateTime? createdAt,
    this.fromAccountName,
    this.toAccountName,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'from_account_id': fromAccountId,
      'to_account_id': toAccountId,
      'amount': amount,
      'note': note,
      'date': date.toIso8601String(),
      'created_at': createdAt.toIso8601String(),
    };
  }

  factory Transfer.fromMap(Map<String, dynamic> map) {
    return Transfer(
      id: map['id'] as String,
      fromAccountId: map['from_account_id'] as String,
      toAccountId: map['to_account_id'] as String,
      amount: (map['amount'] as num?)?.toDouble() ?? 0,
      note: map['note'] as String?,
      date: DateTime.parse(map['date'] as String),
      createdAt: DateTime.parse(map['created_at'] as String),
      fromAccountName: map['from_account_name'] as String?,
      toAccountName: map['to_account_name'] as String?,
    );
  }
}
