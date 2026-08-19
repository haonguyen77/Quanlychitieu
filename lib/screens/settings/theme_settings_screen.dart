import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/theme_provider.dart';

class ThemeSettingsScreen extends StatelessWidget {
  const ThemeSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Giao diện')),
      body: Consumer<ThemeProvider>(
        builder: (context, themeProvider, child) {
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Theme mode
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Chế độ', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      RadioListTile<ThemeMode>(
                        title: const Text('Sáng'),
                        secondary: const Icon(Icons.light_mode),
                        value: ThemeMode.light,
                        groupValue: themeProvider.themeMode,
                        onChanged: (v) => themeProvider.setThemeMode(v!),
                      ),
                      RadioListTile<ThemeMode>(
                        title: const Text('Tối'),
                        secondary: const Icon(Icons.dark_mode),
                        value: ThemeMode.dark,
                        groupValue: themeProvider.themeMode,
                        onChanged: (v) => themeProvider.setThemeMode(v!),
                      ),
                      RadioListTile<ThemeMode>(
                        title: const Text('Hệ thống'),
                        secondary: const Icon(Icons.settings_suggest),
                        value: ThemeMode.system,
                        groupValue: themeProvider.themeMode,
                        onChanged: (v) => themeProvider.setThemeMode(v!),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Color picker
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Màu chủ đạo', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 12,
                        runSpacing: 12,
                        children: List.generate(ThemeProvider.availableColors.length, (index) {
                          final color = ThemeProvider.availableColors[index];
                          final isSelected = themeProvider.colorIndex == index;
                          return GestureDetector(
                            onTap: () => themeProvider.setColorIndex(index),
                            child: Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                color: color,
                                shape: BoxShape.circle,
                                border: isSelected
                                    ? Border.all(color: Theme.of(context).colorScheme.onSurface, width: 3)
                                    : null,
                                boxShadow: isSelected
                                    ? [BoxShadow(color: color.withValues(alpha: 0.4), blurRadius: 8, spreadRadius: 2)]
                                    : null,
                              ),
                              child: isSelected
                                  ? const Icon(Icons.check, color: Colors.white, size: 24)
                                  : null,
                            ),
                          );
                        }),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Font size
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Cỡ chữ', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: ThemeProvider.fontScaleLabels
                            .map((label) => Text(label, style: Theme.of(context).textTheme.bodySmall))
                            .toList(),
                      ),
                      Slider(
                        value: ThemeProvider.fontScales.indexOf(themeProvider.fontScale).toDouble().clamp(0, 4),
                        min: 0,
                        max: 4,
                        divisions: 4,
                        onChanged: (v) {
                          themeProvider.setFontScale(ThemeProvider.fontScales[v.toInt()]);
                        },
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Preview card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Xem trước', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Tiêu đề lớn', style: Theme.of(context).textTheme.titleLarge),
                            const SizedBox(height: 4),
                            Text('Tiêu đề nhỏ', style: Theme.of(context).textTheme.titleSmall),
                            const SizedBox(height: 8),
                            Text('Đây là đoạn văn bản mẫu để xem trước cỡ chữ và màu sắc.',
                                style: Theme.of(context).textTheme.bodyMedium),
                            const SizedBox(height: 8),
                            Text('-500.000 ₫',
                                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                    color: Theme.of(context).colorScheme.error, fontWeight: FontWeight.bold)),
                            Text('+2.000.000 ₫',
                                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                    color: Colors.green, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
