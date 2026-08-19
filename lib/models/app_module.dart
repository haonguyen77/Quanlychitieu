class AppModule {
  final String id;
  final String name;
  final String icon;
  final String color;
  final int sortOrder;
  final bool isDefault;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<ModuleField>? fields;

  AppModule({
    required this.id,
    required this.name,
    this.icon = 'other',
    this.color = '#2196F3',
    this.sortOrder = 0,
    this.isDefault = false,
    this.isActive = true,
    DateTime? createdAt,
    DateTime? updatedAt,
    this.fields,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'icon': icon,
      'color': color,
      'sort_order': sortOrder,
      'is_default': isDefault ? 1 : 0,
      'is_active': isActive ? 1 : 0,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  factory AppModule.fromMap(Map<String, dynamic> map) {
    return AppModule(
      id: map['id'] as String,
      name: map['name'] as String,
      icon: map['icon'] as String? ?? 'other',
      color: map['color'] as String? ?? '#2196F3',
      sortOrder: map['sort_order'] as int? ?? 0,
      isDefault: (map['is_default'] as int? ?? 0) == 1,
      isActive: (map['is_active'] as int? ?? 1) == 1,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
    );
  }

  AppModule copyWith({
    String? id,
    String? name,
    String? icon,
    String? color,
    int? sortOrder,
    bool? isDefault,
    bool? isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
    List<ModuleField>? fields,
  }) {
    return AppModule(
      id: id ?? this.id,
      name: name ?? this.name,
      icon: icon ?? this.icon,
      color: color ?? this.color,
      sortOrder: sortOrder ?? this.sortOrder,
      isDefault: isDefault ?? this.isDefault,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      fields: fields ?? this.fields,
    );
  }
}

class ModuleField {
  final String id;
  final String moduleId;
  final String fieldName;
  final String fieldLabel;
  final String fieldType; // text, number, select, date, boolean
  final int sortOrder;
  final bool isRequired;
  final String? defaultValue;
  final String? options; // comma-separated for select type
  final DateTime createdAt;

  ModuleField({
    required this.id,
    required this.moduleId,
    required this.fieldName,
    required this.fieldLabel,
    this.fieldType = 'text',
    this.sortOrder = 0,
    this.isRequired = false,
    this.defaultValue,
    this.options,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'module_id': moduleId,
      'field_name': fieldName,
      'field_label': fieldLabel,
      'field_type': fieldType,
      'sort_order': sortOrder,
      'is_required': isRequired ? 1 : 0,
      'default_value': defaultValue,
      'options': options,
      'created_at': createdAt.toIso8601String(),
    };
  }

  factory ModuleField.fromMap(Map<String, dynamic> map) {
    return ModuleField(
      id: map['id'] as String,
      moduleId: map['module_id'] as String,
      fieldName: map['field_name'] as String,
      fieldLabel: map['field_label'] as String,
      fieldType: map['field_type'] as String? ?? 'text',
      sortOrder: map['sort_order'] as int? ?? 0,
      isRequired: (map['is_required'] as int? ?? 0) == 1,
      defaultValue: map['default_value'] as String?,
      options: map['options'] as String?,
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }

  ModuleField copyWith({
    String? id,
    String? moduleId,
    String? fieldName,
    String? fieldLabel,
    String? fieldType,
    int? sortOrder,
    bool? isRequired,
    String? defaultValue,
    String? options,
    DateTime? createdAt,
  }) {
    return ModuleField(
      id: id ?? this.id,
      moduleId: moduleId ?? this.moduleId,
      fieldName: fieldName ?? this.fieldName,
      fieldLabel: fieldLabel ?? this.fieldLabel,
      fieldType: fieldType ?? this.fieldType,
      sortOrder: sortOrder ?? this.sortOrder,
      isRequired: isRequired ?? this.isRequired,
      defaultValue: defaultValue ?? this.defaultValue,
      options: options ?? this.options,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  List<String> get optionsList {
    if (options == null || options!.isEmpty) return [];
    return options!.split(',').map((e) => e.trim()).toList();
  }
}
