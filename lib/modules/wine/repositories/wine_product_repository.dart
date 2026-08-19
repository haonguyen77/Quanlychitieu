import 'package:uuid/uuid.dart';
import '../../../database/database_helper.dart';
import '../models/wine_product.dart';
import '../models/wine_variant.dart';

class WineProductRepository {
  final _uuid = const Uuid();

  // --- Products ---
  Future<List<WineProduct>> getAll({bool activeOnly = true}) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query(
      'wine_products',
      where: activeOnly ? 'is_active = 1' : null,
      orderBy: 'name ASC',
    );
    return result.map((m) => WineProduct.fromMap(m)).toList();
  }

  Future<WineProduct?> getById(String id) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query('wine_products', where: 'id = ?', whereArgs: [id]);
    if (result.isEmpty) return null;
    return WineProduct.fromMap(result.first);
  }

  Future<WineProduct> getWithVariants(String id) async {
    final product = await getById(id);
    if (product == null) throw Exception('Product not found');
    final variants = await getProductVariants(id);
    final fields = await getProductFieldValues(id);
    return product.copyWith(variants: variants, customFields: fields);
  }

  Future<WineProduct> insert(WineProduct product) async {
    final db = await DatabaseHelper.instance.database;
    final id = product.id.isEmpty ? _uuid.v4() : product.id;
    final now = DateTime.now();
    final newProduct = product.copyWith(id: id, createdAt: now, updatedAt: now);
    await db.insert('wine_products', newProduct.toMap());
    return newProduct;
  }

  Future<void> update(WineProduct product) async {
    final db = await DatabaseHelper.instance.database;
    final updated = product.copyWith(updatedAt: DateTime.now());
    await db.update('wine_products', updated.toMap(), where: 'id = ?', whereArgs: [product.id]);
  }

  Future<void> delete(String id) async {
    final db = await DatabaseHelper.instance.database;
    await db.update('wine_products', {'is_active': 0, 'updated_at': DateTime.now().toIso8601String()}, where: 'id = ?', whereArgs: [id]);
  }

  // --- Product Variants ---
  Future<List<WineProductVariant>> getProductVariants(String productId) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.rawQuery('''
      SELECT pv.*, vo.name as variant_name, vt.name as variant_type_name,
        (SELECT COALESCE(SUM(si.remaining_quantity), 0) 
         FROM wine_stock_in_items si WHERE si.product_variant_id = pv.id) as current_stock
      FROM wine_product_variants pv
      LEFT JOIN wine_variant_options vo ON pv.variant_option_id = vo.id
      LEFT JOIN wine_variant_types vt ON vo.variant_type_id = vt.id
      WHERE pv.product_id = ? AND pv.is_active = 1
      ORDER BY vo.sort_order ASC
    ''', [productId]);
    return result.map((m) => WineProductVariant.fromMap(m)).toList();
  }

  Future<WineProductVariant> insertVariant(WineProductVariant variant) async {
    final db = await DatabaseHelper.instance.database;
    final id = variant.id.isEmpty ? _uuid.v4() : variant.id;

    // Ensure the variant option exists (for wvo_none which may not exist in older DBs)
    final optionExists = await db.query('wine_variant_options',
        where: 'id = ?', whereArgs: [variant.variantOptionId]);
    if (optionExists.isEmpty) {
      // Create the option if missing
      final typeResult = await db.query('wine_variant_types', where: 'is_active = 1', orderBy: 'sort_order ASC');
      final typeId = typeResult.isNotEmpty ? typeResult.first['id'] as String : 'wvt_color';
      await db.insert('wine_variant_options', {
        'id': variant.variantOptionId,
        'variant_type_id': typeId,
        'name': variant.variantOptionId == 'wvo_none' ? 'Không màu' : variant.variantOptionId,
        'sort_order': 0,
        'is_active': 1,
        'created_at': DateTime.now().toIso8601String(),
      });
    }

    final newVariant = variant.copyWith(id: id, createdAt: DateTime.now());
    await db.insert('wine_product_variants', newVariant.toMap());
    return newVariant;
  }

  Future<void> updateVariant(WineProductVariant variant) async {
    final db = await DatabaseHelper.instance.database;
    await db.update('wine_product_variants', variant.toMap(), where: 'id = ?', whereArgs: [variant.id]);
  }

  Future<void> deleteVariant(String id) async {
    final db = await DatabaseHelper.instance.database;
    await db.update('wine_product_variants', {'is_active': 0}, where: 'id = ?', whereArgs: [id]);
  }

  // --- Variant Types & Options ---
  Future<List<WineVariantType>> getVariantTypes() async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query('wine_variant_types', where: 'is_active = 1', orderBy: 'sort_order ASC');
    final types = <WineVariantType>[];
    for (final map in result) {
      final options = await getVariantOptions(map['id'] as String);
      types.add(WineVariantType.fromMap(map).copyWith(options: options));
    }
    return types;
  }

  Future<List<WineVariantOption>> getVariantOptions(String typeId) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query('wine_variant_options', where: 'variant_type_id = ? AND is_active = 1', whereArgs: [typeId], orderBy: 'sort_order ASC');
    return result.map((m) => WineVariantOption.fromMap(m)).toList();
  }

  Future<List<WineVariantOption>> getAllVariantOptions() async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query('wine_variant_options', where: 'is_active = 1', orderBy: 'sort_order ASC');
    return result.map((m) => WineVariantOption.fromMap(m)).toList();
  }

  Future<WineVariantOption> insertVariantOption(WineVariantOption option) async {
    final db = await DatabaseHelper.instance.database;
    final id = option.id.isEmpty ? _uuid.v4() : option.id;
    final newOption = option.copyWith(id: id);
    await db.insert('wine_variant_options', newOption.toMap());
    return newOption;
  }

  Future<void> updateVariantOption(WineVariantOption option) async {
    final db = await DatabaseHelper.instance.database;
    await db.update('wine_variant_options', option.toMap(), where: 'id = ?', whereArgs: [option.id]);
  }

  Future<void> deleteVariantOption(String id) async {
    final db = await DatabaseHelper.instance.database;
    await db.update('wine_variant_options', {'is_active': 0}, where: 'id = ?', whereArgs: [id]);
  }

  // --- Dynamic Fields ---
  Future<List<WineProductField>> getProductFields() async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query('wine_product_fields', orderBy: 'sort_order ASC');
    return result.map((m) => WineProductField.fromMap(m)).toList();
  }

  Future<WineProductField> insertField(WineProductField field) async {
    final db = await DatabaseHelper.instance.database;
    final id = field.id.isEmpty ? _uuid.v4() : field.id;
    final newField = field.copyWith(id: id);
    await db.insert('wine_product_fields', newField.toMap());
    return newField;
  }

  Future<void> updateField(WineProductField field) async {
    final db = await DatabaseHelper.instance.database;
    await db.update('wine_product_fields', field.toMap(), where: 'id = ?', whereArgs: [field.id]);
  }

  Future<void> deleteField(String id) async {
    final db = await DatabaseHelper.instance.database;
    await db.delete('wine_product_fields', where: 'id = ?', whereArgs: [id]);
    await db.delete('wine_product_field_values', where: 'field_id = ?', whereArgs: [id]);
  }

  Future<Map<String, String>> getProductFieldValues(String productId) async {
    final db = await DatabaseHelper.instance.database;
    final result = await db.query('wine_product_field_values', where: 'product_id = ?', whereArgs: [productId]);
    final map = <String, String>{};
    for (final row in result) {
      map[row['field_id'] as String] = row['value'] as String? ?? '';
    }
    return map;
  }

  Future<void> saveProductFieldValues(String productId, Map<String, String> values) async {
    final db = await DatabaseHelper.instance.database;
    await db.delete('wine_product_field_values', where: 'product_id = ?', whereArgs: [productId]);
    for (final entry in values.entries) {
      await db.insert('wine_product_field_values', {
        'id': _uuid.v4(),
        'product_id': productId,
        'field_id': entry.key,
        'value': entry.value,
      });
    }
  }
}
