class ActivityLog {
  final String id;
  final String action; // create, update, delete, restore
  final String entityType; // transaction, category, account, module, etc.
  final String entityId;
  final String? oldData; // JSON string
  final String? newData; // JSON string
  final DateTime createdAt;

  ActivityLog({
    required this.id,
    required this.action,
    required this.entityType,
    required this.entityId,
    this.oldData,
    this.newData,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'action': action,
      'entity_type': entityType,
      'entity_id': entityId,
      'old_data': oldData,
      'new_data': newData,
      'created_at': createdAt.toIso8601String(),
    };
  }

  factory ActivityLog.fromMap(Map<String, dynamic> map) {
    return ActivityLog(
      id: map['id'] as String,
      action: map['action'] as String,
      entityType: map['entity_type'] as String,
      entityId: map['entity_id'] as String,
      oldData: map['old_data'] as String?,
      newData: map['new_data'] as String?,
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }

  String get actionLabel {
    switch (action) {
      case 'create':
        return 'Tạo mới';
      case 'update':
        return 'Cập nhật';
      case 'delete':
        return 'Xóa';
      case 'restore':
        return 'Khôi phục';
      default:
        return action;
    }
  }

  String get entityTypeLabel {
    switch (entityType) {
      case 'transaction':
        return 'Giao dịch';
      case 'category':
        return 'Danh mục';
      case 'account':
        return 'Tài khoản';
      case 'module':
        return 'Module';
      case 'budget':
        return 'Ngân sách';
      case 'transfer':
        return 'Chuyển tiền';
      default:
        return entityType;
    }
  }
}
