import 'dart:io';
import 'package:flutter/material.dart';
import 'package:excel/excel.dart';
import 'package:uuid/uuid.dart';
import 'package:intl/intl.dart';
import 'package:file_picker/file_picker.dart';
import '../../database/database_helper.dart';

class ImportScreen extends StatefulWidget {
  const ImportScreen({super.key});

  @override
  State<ImportScreen> createState() => _ImportScreenState();
}

class _ImportScreenState extends State<ImportScreen> {
  String? _fileName;
  List<List<String>> _previewRows = [];
  List<String> _headers = [];
  bool _isLoading = false;
  bool _isImporting = false;
  String? _errorMessage;

  // Column mapping
  int _dateColumn = -1;
  int _amountColumn = -1;
  int _titleColumn = -1;
  int _categoryColumn = -1;
  int _noteColumn = -1;
  int _typeColumn = -1;

  // Import results
  int _importedCount = 0;
  int _skippedCount = 0;
  bool _showResults = false;

  // All parsed data rows (beyond preview)
  List<List<String>> _allDataRows = [];

  Future<void> _pickFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['xlsx', 'xls', 'csv'],
      );

      if (result == null || result.files.isEmpty) return;

      final file = result.files.first;
      if (file.path == null) return;

      setState(() {
        _fileName = file.name;
        _errorMessage = null;
        _showResults = false;
        _isLoading = true;
      });

      await _parseFile(file.path!);
    } catch (e) {
      setState(() {
        _errorMessage = 'Lỗi chọn file: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _parseFile(String path) async {
    try {
      final extension = path.split('.').last.toLowerCase();

      if (extension == 'csv') {
        await _parseCsv(path);
      } else {
        await _parseExcel(path);
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Lỗi đọc file: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _parseCsv(String path) async {
    final content = await File(path).readAsString();
    final lines = content.split('\n').where((l) => l.trim().isNotEmpty).toList();

    if (lines.isEmpty) {
      setState(() { _errorMessage = 'File rỗng'; _isLoading = false; });
      return;
    }

    // Detect separator (comma or semicolon)
    final separator = lines.first.contains(';') ? ';' : ',';
    final allRows = lines.map((line) => line.split(separator).map((c) => c.trim().replaceAll('"', '')).toList()).toList();

    _setData(allRows);
  }

  Future<void> _parseExcel(String path) async {
    final bytes = await File(path).readAsBytes();
    final excel = Excel.decodeBytes(bytes);

    final sheet = excel.tables[excel.tables.keys.first];
    if (sheet == null || sheet.rows.isEmpty) {
      setState(() { _errorMessage = 'File Excel rỗng'; _isLoading = false; });
      return;
    }

    final allRows = sheet.rows.map((row) {
      return row.map((cell) => cell?.value?.toString() ?? '').toList();
    }).toList();

    _setData(allRows);
  }

  void _setData(List<List<String>> allRows) {
    if (allRows.isEmpty) {
      setState(() { _errorMessage = 'Không có dữ liệu'; _isLoading = false; });
      return;
    }

    final headers = allRows.first;
    final dataRows = allRows.skip(1).toList();

    // Auto-detect columns
    _autoDetectColumns(headers);

    setState(() {
      _headers = headers;
      _allDataRows = dataRows;
      _previewRows = dataRows.take(5).toList();
      _isLoading = false;
    });
  }

  void _autoDetectColumns(List<String> headers) {
    for (int i = 0; i < headers.length; i++) {
      final h = headers[i].toLowerCase();
      if (h.contains('ngày') || h.contains('date') || h.contains('ngay')) {
        _dateColumn = i;
      } else if (h.contains('số tiền') || h.contains('amount') || h.contains('so tien') || h.contains('tiền')) {
        _amountColumn = i;
      } else if (h.contains('tên') || h.contains('title') || h.contains('ten') || h.contains('mô tả') || h.contains('nội dung')) {
        _titleColumn = i;
      } else if (h.contains('danh mục') || h.contains('category') || h.contains('loại')) {
        if (_typeColumn == -1 && (h.contains('loại gd') || h == 'loại')) {
          _typeColumn = i;
        } else {
          _categoryColumn = i;
        }
      } else if (h.contains('ghi chú') || h.contains('note')) {
        _noteColumn = i;
      } else if (h.contains('chi/thu') || h.contains('type') || h.contains('loại')) {
        _typeColumn = i;
      }
    }
  }

  Future<void> _importData() async {
    if (_dateColumn < 0 || _amountColumn < 0 || _titleColumn < 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng chọn cột Ngày, Số tiền và Tên'), behavior: SnackBarBehavior.floating),
      );
      return;
    }

    setState(() { _isImporting = true; _importedCount = 0; _skippedCount = 0; });

    final db = await DatabaseHelper.instance.database;
    const uuid = Uuid();

    for (final row in _allDataRows) {
      try {
        // Parse date
        final dateStr = _safeGet(row, _dateColumn);
        final date = _parseDate(dateStr);
        if (date == null) { _skippedCount++; continue; }

        // Parse amount
        final amountStr = _safeGet(row, _amountColumn);
        final amount = _parseAmount(amountStr);
        if (amount == 0) { _skippedCount++; continue; }

        // Parse title
        final title = _safeGet(row, _titleColumn);
        if (title.isEmpty) { _skippedCount++; continue; }

        // Parse type
        int type = 0; // 0 = expense, 1 = income
        if (_typeColumn >= 0) {
          final typeStr = _safeGet(row, _typeColumn).toLowerCase();
          if (typeStr.contains('thu') || typeStr.contains('income') || typeStr == '1') {
            type = 1;
          }
        }
        if (amount < 0) { type = 0; }

        // Note
        final note = _noteColumn >= 0 ? _safeGet(row, _noteColumn) : '';

        // Category (optional lookup)
        String? categoryId;
        if (_categoryColumn >= 0) {
          final catName = _safeGet(row, _categoryColumn);
          if (catName.isNotEmpty) {
            final catResult = await db.query('categories', where: 'name = ?', whereArgs: [catName], limit: 1);
            if (catResult.isNotEmpty) {
              categoryId = catResult.first['id'] as String;
            }
          }
        }

        final now = DateTime.now().toIso8601String();
        await db.insert('transactions', {
          'id': uuid.v4(),
          'title': title,
          'amount': amount.abs(),
          'type': type,
          'date': date.toIso8601String(),
          'category_id': categoryId,
          'account_id': null,
          'module_id': 'mod_chitieu',
          'note': note.isEmpty ? null : note,
          'tags': null,
          'is_deleted': 0,
          'created_at': now,
          'updated_at': now,
        });
        _importedCount++;
      } catch (e) {
        _skippedCount++;
      }
    }

    setState(() { _isImporting = false; _showResults = true; });
  }

  String _safeGet(List<String> row, int index) {
    if (index < 0 || index >= row.length) return '';
    return row[index].trim();
  }

  DateTime? _parseDate(String dateStr) {
    if (dateStr.isEmpty) return null;
    // Try common formats
    final formats = [
      DateFormat('dd/MM/yyyy HH:mm'),
      DateFormat('dd/MM/yyyy'),
      DateFormat('yyyy-MM-dd HH:mm:ss'),
      DateFormat('yyyy-MM-dd'),
      DateFormat('MM/dd/yyyy'),
      DateFormat('d/M/yyyy'),
    ];
    for (final fmt in formats) {
      try { return fmt.parse(dateStr); } catch (_) {}
    }
    try { return DateTime.parse(dateStr); } catch (_) {}
    return null;
  }

  double _parseAmount(String amountStr) {
    if (amountStr.isEmpty) return 0;
    // Remove currency symbols and formatting
    final cleaned = amountStr
        .replaceAll('₫', '')
        .replaceAll('đ', '')
        .replaceAll('.', '')
        .replaceAll(',', '.')
        .replaceAll(' ', '')
        .trim();
    return double.tryParse(cleaned) ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nhập dữ liệu')),
      body: SingleChildScrollView(
        padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: MediaQuery.of(context).viewInsets.bottom + 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // File picker
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Chọn file', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    Text('Hỗ trợ: Excel (.xlsx, .xls), CSV (.csv)', style: Theme.of(context).textTheme.bodySmall),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _isLoading ? null : _pickFile,
                        icon: const Icon(Icons.file_open),
                        label: Text(_fileName ?? 'Chọn file...'),
                      ),
                    ),
                    if (_errorMessage != null) ...[
                      const SizedBox(height: 8),
                      Text(_errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12)),
                    ],
                  ],
                ),
              ),
            ),

            if (_isLoading) ...[
              const SizedBox(height: 24),
              const Center(child: CircularProgressIndicator()),
            ],

            // Preview
            if (_previewRows.isNotEmpty) ...[
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Xem trước (${_allDataRows.length} dòng)', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                          Text('5 dòng đầu', style: Theme.of(context).textTheme.bodySmall),
                        ],
                      ),
                      const SizedBox(height: 8),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: DataTable(
                          columnSpacing: 16,
                          dataRowMinHeight: 32,
                          dataRowMaxHeight: 40,
                          headingRowHeight: 36,
                          columns: _headers.map((h) => DataColumn(label: Text(h, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)))).toList(),
                          rows: _previewRows.map((row) => DataRow(
                            cells: List.generate(_headers.length, (i) => DataCell(
                              Text(i < row.length ? row[i] : '', style: const TextStyle(fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
                            )),
                          )).toList(),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Column mapping
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Ánh xạ cột', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      Text('Chọn cột tương ứng với từng trường dữ liệu', style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 12),
                      _ColumnDropdown(
                        label: 'Ngày *',
                        headers: _headers,
                        value: _dateColumn,
                        onChanged: (v) => setState(() => _dateColumn = v),
                      ),
                      _ColumnDropdown(
                        label: 'Số tiền *',
                        headers: _headers,
                        value: _amountColumn,
                        onChanged: (v) => setState(() => _amountColumn = v),
                      ),
                      _ColumnDropdown(
                        label: 'Tên / Mô tả *',
                        headers: _headers,
                        value: _titleColumn,
                        onChanged: (v) => setState(() => _titleColumn = v),
                      ),
                      _ColumnDropdown(
                        label: 'Danh mục',
                        headers: _headers,
                        value: _categoryColumn,
                        onChanged: (v) => setState(() => _categoryColumn = v),
                      ),
                      _ColumnDropdown(
                        label: 'Loại (Chi/Thu)',
                        headers: _headers,
                        value: _typeColumn,
                        onChanged: (v) => setState(() => _typeColumn = v),
                      ),
                      _ColumnDropdown(
                        label: 'Ghi chú',
                        headers: _headers,
                        value: _noteColumn,
                        onChanged: (v) => setState(() => _noteColumn = v),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Import button
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton.icon(
                  onPressed: _isImporting ? null : _importData,
                  icon: _isImporting
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.file_upload),
                  label: Text(_isImporting ? 'Đang nhập...' : 'Nhập dữ liệu (${_allDataRows.length} dòng)'),
                ),
              ),
            ],

            // Results
            if (_showResults) ...[
              const SizedBox(height: 16),
              Card(
                color: Colors.green.withValues(alpha: 0.1),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.check_circle, color: Colors.green, size: 24),
                          const SizedBox(width: 8),
                          Text('Hoàn tất!', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text('Đã nhập: $_importedCount giao dịch'),
                      if (_skippedCount > 0) Text('Bỏ qua: $_skippedCount dòng (lỗi hoặc thiếu dữ liệu)'),
                    ],
                  ),
                ),
              ),
            ],

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

class _ColumnDropdown extends StatelessWidget {
  final String label;
  final List<String> headers;
  final int value;
  final ValueChanged<int> onChanged;

  const _ColumnDropdown({
    required this.label,
    required this.headers,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500)),
          ),
          Expanded(
            child: DropdownButtonFormField<int>(
              value: value >= 0 && value < headers.length ? value : null,
              isDense: true,
              isExpanded: true,
              decoration: const InputDecoration(
                isDense: true,
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              items: [
                const DropdownMenuItem<int>(value: -1, child: Text('-- Bỏ qua --', style: TextStyle(fontSize: 12))),
                ...List.generate(headers.length, (i) => DropdownMenuItem<int>(
                  value: i,
                  child: Text(headers[i], style: const TextStyle(fontSize: 12), overflow: TextOverflow.ellipsis),
                )),
              ],
              onChanged: (v) => onChanged(v ?? -1),
            ),
          ),
        ],
      ),
    );
  }
}
