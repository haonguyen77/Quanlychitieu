import 'dart:io';
import 'package:flutter/material.dart';
import 'package:excel/excel.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:open_file/open_file.dart';
import 'package:share_plus/share_plus.dart';
import '../../providers/transaction_provider.dart';
import '../../providers/module_provider.dart';
import '../../database/database_helper.dart';
import '../../utils/formatters.dart';
import 'import_screen.dart';

class ExportExcelScreen extends StatefulWidget {
  const ExportExcelScreen({super.key});

  @override
  State<ExportExcelScreen> createState() => _ExportExcelScreenState();
}

class _ExportExcelScreenState extends State<ExportExcelScreen> {
  bool _isExporting = false;
  bool _exportAll = false;
  String? _lastExportPath;
  DateTime _startDate = DateTime(DateTime.now().year, 1, 1);
  DateTime _endDate = DateTime.now();

  // Effective range used by the queries. When "All" is on, cover everything.
  DateTime get _effStart => _exportAll ? DateTime(1970, 1, 1) : _startDate;
  DateTime get _effEnd => _exportAll ? DateTime(2999, 12, 31) : _endDate;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Xuất Excel')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Date range
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text('Khoảng thời gian', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                        ),
                        // "All" toggle — export every record regardless of date.
                        FilterChip(
                          label: const Text('All'),
                          selected: _exportAll,
                          onSelected: (v) => setState(() => _exportAll = v),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: _exportAll ? null : () async {
                              final picked = await showDatePicker(context: context, initialDate: _startDate, firstDate: DateTime(2020), lastDate: DateTime.now());
                              if (picked != null) setState(() => _startDate = picked);
                            },
                            child: InputDecorator(
                              decoration: const InputDecoration(labelText: 'Từ ngày', isDense: true, border: OutlineInputBorder()),
                              child: Text(_exportAll ? 'Tất cả' : Formatters.date(_startDate)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: InkWell(
                            onTap: _exportAll ? null : () async {
                              final picked = await showDatePicker(context: context, initialDate: _endDate, firstDate: DateTime(2020), lastDate: DateTime.now().add(const Duration(days: 1)));
                              if (picked != null) setState(() => _endDate = picked);
                            },
                            child: InputDecorator(
                              decoration: const InputDecoration(labelText: 'Đến ngày', isDense: true, border: OutlineInputBorder()),
                              child: Text(_exportAll ? 'Tất cả' : Formatters.date(_endDate)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Info
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Nội dung xuất', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    const Text('File Excel sẽ bao gồm:'),
                    const SizedBox(height: 4),
                    const Text('• Sheet "Tất cả" - Toàn bộ giao dịch'),
                    const Text('• Sheet "Shopee" - Giao dịch Shopee'),
                    const Text('• Sheet "Vàng" - Giao dịch vàng'),
                    const Text('• Sheet "Nhà trọ" - Giao dịch nhà trọ'),
                    const Text('• Sheet "Thẻ tín dụng" - Giao dịch thẻ'),
                    const Text('• Sheet "Rượu" - Đơn hàng rượu'),
                    const Text('• Sheet "Khách hàng" - Danh sách khách'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Export button
            SizedBox(
              width: double.infinity,
              height: 52,
              child: FilledButton.icon(
                onPressed: _isExporting ? null : _exportExcel,
                icon: _isExporting
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.file_download),
                label: const Text('Xuất file Excel'),
              ),
            ),

            if (_lastExportPath != null) ...[
              const SizedBox(height: 12),
              Card(
                color: Colors.green.withValues(alpha: 0.1),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.check_circle, color: Colors.green, size: 20),
                          const SizedBox(width: 8),
                          Expanded(child: Text('Đã xuất: ${p.basename(_lastExportPath!)}',
                              style: Theme.of(context).textTheme.bodySmall)),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => OpenFile.open(_lastExportPath!),
                              icon: const Icon(Icons.open_in_new, size: 18),
                              label: const Text('Mở file'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => Share.shareXFiles([XFile(_lastExportPath!)], text: 'Xuất dữ liệu chi tiêu'),
                              icon: const Icon(Icons.share, size: 18),
                              label: const Text('Chia sẻ'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],

            const SizedBox(height: 24),
            const Divider(),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ImportScreen())),
                icon: const Icon(Icons.file_upload),
                label: const Text('Nhập dữ liệu từ file'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _exportExcel() async {
    setState(() => _isExporting = true);

    try {
      final db = await DatabaseHelper.instance.database;
      final excel = Excel.createExcel();

      // Sheet 1: All transactions (replaces old "Tất cả" + "Chi tiêu" duplicate)
      await _addTransactionSheet(excel, db, 'Tất cả', null);

      // Sheet per module (skip Chi tiêu - already in "Tất cả", skip Rượu - has separate sheet, skip Thẻ tín dụng - has separate sheet)
      final modules = await db.query('modules', where: 'is_active = 1', orderBy: 'sort_order ASC');
      for (final mod in modules) {
        final modName = mod['name'] as String;
        final modId = mod['id'] as String;
        if (modId == 'mod_chitieu' || modId == 'mod_ruou' || modId == 'mod_creditcard') continue;
        await _addTransactionSheet(excel, db, modName, modId);
      }

      // Sheet: Thẻ tín dụng
      await _addCreditCardSheet(excel, db);

      // Sheet: Rượu orders
      await _addWineOrdersSheet(excel, db);

      // Sheet: Khách hàng
      await _addCustomersSheet(excel, db);

      // Remove default sheet
      if (excel.sheets.containsKey('Sheet1')) {
        excel.delete('Sheet1');
      }

      // Save file
      final dir = await getExternalStorageDirectory() ?? await getApplicationDocumentsDirectory();
      final timestamp = DateFormat('yyyyMMdd_HHmmss').format(DateTime.now());
      final filePath = p.join(dir.path, 'QuanLyChiTieu_$timestamp.xlsx');
      final fileBytes = excel.save();
      if (fileBytes != null) {
        await File(filePath).writeAsBytes(fileBytes);
        setState(() => _lastExportPath = filePath);

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Đã xuất Excel thành công!\n$filePath'),
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 4),
          ));
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Lỗi xuất Excel: $e'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    } finally {
      setState(() => _isExporting = false);
    }
  }

  Future<void> _addTransactionSheet(Excel excel, dynamic db, String sheetName, String? moduleId) async {
    final sheet = excel[sheetName];

    // Header
    final headers = ['Ngày', 'Loại', 'Tên', 'Số tiền', 'Danh mục', 'Tài khoản', 'Module', 'Ghi chú', 'Tag'];
    for (int i = 0; i < headers.length; i++) {
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 0)).value = TextCellValue(headers[i]);
    }

    // Query
    String where = 'date >= ? AND date <= ? AND is_deleted = 0';
    List<dynamic> whereArgs = [_effStart.toIso8601String(), _effEnd.add(const Duration(days: 1)).toIso8601String()];

    if (moduleId != null) {
      where += ' AND (module_id = ? OR linked_module_id = ?)';
      whereArgs.add(moduleId);
      whereArgs.add(moduleId);
    }

    final results = await db.rawQuery('''
      SELECT t.*, c.name as category_name, a.name as account_name, m.name as module_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN modules m ON t.module_id = m.id
      WHERE $where
      ORDER BY t.date DESC
    ''', whereArgs);

    for (int row = 0; row < results.length; row++) {
      final t = results[row];
      final r = row + 1;
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: r)).value = TextCellValue(
          DateFormat('dd/MM/yyyy HH:mm').format(DateTime.parse(t['date'] as String)));
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 1, rowIndex: r)).value =
          TextCellValue(t['type'] == 0 ? 'Chi' : 'Thu');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 2, rowIndex: r)).value =
          TextCellValue(t['title'] as String? ?? '');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 3, rowIndex: r)).value =
          DoubleCellValue((t['amount'] as num?)?.toDouble() ?? 0);
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 4, rowIndex: r)).value =
          TextCellValue(t['category_name'] as String? ?? '');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 5, rowIndex: r)).value =
          TextCellValue(t['account_name'] as String? ?? '');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 6, rowIndex: r)).value =
          TextCellValue(t['module_name'] as String? ?? '');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 7, rowIndex: r)).value =
          TextCellValue(t['note'] as String? ?? '');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 8, rowIndex: r)).value =
          TextCellValue(t['tags'] as String? ?? '');
    }
  }

  Future<void> _addCreditCardSheet(Excel excel, dynamic db) async {
    final sheet = excel['Thẻ tín dụng'];

    final headers = ['Ngày', 'Thẻ', 'Ngân hàng', 'Tên GD', 'Số tiền', 'Loại', 'Trả góp (tháng)', 'Kỳ hiện tại', 'Số tiền/kỳ', 'Đã thanh toán', 'Ghi chú'];
    for (int i = 0; i < headers.length; i++) {
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 0)).value = TextCellValue(headers[i]);
    }

    final results = await db.rawQuery('''
      SELECT cct.*, cc.name as card_name, cc.bank_name
      FROM credit_card_transactions cct
      JOIN credit_cards cc ON cct.card_id = cc.id
      WHERE cct.date >= ? AND cct.date <= ?
      ORDER BY cct.date DESC
    ''', [_effStart.toIso8601String(), _effEnd.add(const Duration(days: 1)).toIso8601String()]);

    for (int row = 0; row < results.length; row++) {
      final t = results[row];
      final r = row + 1;
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: r)).value = TextCellValue(
          DateFormat('dd/MM/yyyy').format(DateTime.parse(t['date'] as String)));
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 1, rowIndex: r)).value =
          TextCellValue(t['card_name'] as String? ?? '');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 2, rowIndex: r)).value =
          TextCellValue(t['bank_name'] as String? ?? '');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 3, rowIndex: r)).value =
          TextCellValue(t['title'] as String? ?? '');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 4, rowIndex: r)).value =
          DoubleCellValue((t['amount'] as num?)?.toDouble() ?? 0);
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 5, rowIndex: r)).value =
          TextCellValue(t['type'] as String? ?? 'expense');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 6, rowIndex: r)).value =
          IntCellValue((t['installment_months'] as num?)?.toInt() ?? 0);
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 7, rowIndex: r)).value =
          IntCellValue((t['installment_current'] as num?)?.toInt() ?? 0);
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 8, rowIndex: r)).value =
          DoubleCellValue((t['installment_monthly'] as num?)?.toDouble() ?? 0);
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 9, rowIndex: r)).value =
          TextCellValue((t['is_paid'] as int?) == 1 ? 'Đã TT' : 'Chưa TT');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 10, rowIndex: r)).value =
          TextCellValue(t['note'] as String? ?? '');
    }
  }

  Future<void> _addWineOrdersSheet(Excel excel, dynamic db) async {
    final sheet = excel['Rượu - Đơn hàng'];

    final headers = ['Ngày', 'Khách hàng', 'SĐT', 'Địa chỉ', 'Sản phẩm', 'Màu', 'SL', 'Giá', 'Thành tiền', 'Ship', 'Tổng', 'Ghi chú'];
    for (int i = 0; i < headers.length; i++) {
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 0)).value = TextCellValue(headers[i]);
    }

    final orders = await db.rawQuery('''
      SELECT so.*, soi.quantity, soi.price, soi.has_glass, soi.has_box,
        p.name as product_name, vo.name as variant_name
      FROM wine_sales_orders so
      JOIN wine_sales_order_items soi ON so.id = soi.sales_order_id
      LEFT JOIN wine_product_variants pv ON soi.product_variant_id = pv.id
      LEFT JOIN wine_products p ON pv.product_id = p.id
      LEFT JOIN wine_variant_options vo ON pv.variant_option_id = vo.id
      WHERE so.date >= ? AND so.date <= ?
      ORDER BY so.date DESC
    ''', [_effStart.toIso8601String(), _effEnd.add(const Duration(days: 1)).toIso8601String()]);

    for (int row = 0; row < orders.length; row++) {
      final o = orders[row];
      final r = row + 1;
      final qty = (o['quantity'] as num?)?.toInt() ?? 0;
      final price = (o['price'] as num?)?.toDouble() ?? 0;

      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: r)).value = TextCellValue(
          DateFormat('dd/MM/yyyy').format(DateTime.parse(o['date'] as String)));
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 1, rowIndex: r)).value = TextCellValue(o['customer_name'] as String? ?? '');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 2, rowIndex: r)).value = TextCellValue(o['customer_phone'] as String? ?? '');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 3, rowIndex: r)).value = TextCellValue(o['customer_address'] as String? ?? '');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 4, rowIndex: r)).value = TextCellValue(o['product_name'] as String? ?? '');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 5, rowIndex: r)).value = TextCellValue(o['variant_name'] as String? ?? '');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 6, rowIndex: r)).value = IntCellValue(qty);
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 7, rowIndex: r)).value = DoubleCellValue(price);
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 8, rowIndex: r)).value = DoubleCellValue(qty * price);
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 9, rowIndex: r)).value = DoubleCellValue((o['shipping_fee'] as num?)?.toDouble() ?? 0);
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 10, rowIndex: r)).value = DoubleCellValue((o['total_amount'] as num?)?.toDouble() ?? 0);
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 11, rowIndex: r)).value = TextCellValue(o['note1'] as String? ?? '');
    }
  }

  Future<void> _addCustomersSheet(Excel excel, dynamic db) async {
    final sheet = excel['Khách hàng'];

    final headers = ['Tên', 'SĐT', 'Địa chỉ', 'Ghi chú'];
    for (int i = 0; i < headers.length; i++) {
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 0)).value = TextCellValue(headers[i]);
    }

    final customers = await db.query('wine_customers', where: 'is_active = 1', orderBy: 'name ASC');
    for (int row = 0; row < customers.length; row++) {
      final c = customers[row];
      final r = row + 1;
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: r)).value = TextCellValue(c['name'] as String? ?? '');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 1, rowIndex: r)).value = TextCellValue(c['phone'] as String? ?? '');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 2, rowIndex: r)).value = TextCellValue(c['address'] as String? ?? '');
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 3, rowIndex: r)).value = TextCellValue(c['note'] as String? ?? '');
    }
  }
}
