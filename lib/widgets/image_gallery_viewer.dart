import 'dart:io';
import 'package:flutter/material.dart';

/// Fullscreen image gallery viewer with swipe navigation, zoom, and delete.
/// 
/// Usage:
/// ```dart
/// ImageGalleryViewer.show(context, imagePaths: [...], initialIndex: 0, onDelete: (index) { ... });
/// ```
class ImageGalleryViewer extends StatefulWidget {
  final List<String> imagePaths;
  final int initialIndex;
  final void Function(int index)? onDelete;

  const ImageGalleryViewer({
    super.key,
    required this.imagePaths,
    this.initialIndex = 0,
    this.onDelete,
  });

  /// Show the gallery viewer as a fullscreen route.
  static void show(
    BuildContext context, {
    required List<String> imagePaths,
    int initialIndex = 0,
    void Function(int index)? onDelete,
  }) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ImageGalleryViewer(
          imagePaths: imagePaths,
          initialIndex: initialIndex,
          onDelete: onDelete,
        ),
      ),
    );
  }

  @override
  State<ImageGalleryViewer> createState() => _ImageGalleryViewerState();
}

class _ImageGalleryViewerState extends State<ImageGalleryViewer> {
  late PageController _pageController;
  late int _currentIndex;
  late List<String> _images;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _images = List.from(widget.imagePaths);
    _pageController = PageController(initialPage: _currentIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onDelete() {
    if (_images.isEmpty) return;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa ảnh'),
        content: const Text('Bạn có chắc muốn xóa ảnh này?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              final deletedIndex = _currentIndex;
              widget.onDelete?.call(deletedIndex);
              setState(() {
                _images.removeAt(deletedIndex);
                if (_images.isEmpty) {
                  Navigator.pop(context);
                  return;
                }
                if (_currentIndex >= _images.length) {
                  _currentIndex = _images.length - 1;
                }
                _pageController = PageController(initialPage: _currentIndex);
              });
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          '${_currentIndex + 1} / ${_images.length}',
          style: const TextStyle(color: Colors.white, fontSize: 16),
        ),
        centerTitle: true,
        actions: [
          if (widget.onDelete != null)
            IconButton(
              icon: const Icon(Icons.delete_outline, color: Colors.white),
              onPressed: _onDelete,
              tooltip: 'Xóa ảnh',
            ),
        ],
      ),
      body: _images.isEmpty
          ? const Center(child: Text('Không có ảnh', style: TextStyle(color: Colors.white)))
          : PageView.builder(
              controller: _pageController,
              itemCount: _images.length,
              onPageChanged: (index) {
                setState(() => _currentIndex = index);
              },
              itemBuilder: (context, index) {
                final path = _images[index];
                return _ImagePage(path: path);
              },
            ),
      bottomNavigationBar: _images.length > 1
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(
                    _images.length,
                    (i) => AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      width: i == _currentIndex ? 10 : 6,
                      height: i == _currentIndex ? 10 : 6,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: i == _currentIndex
                            ? Colors.white
                            : Colors.white38,
                      ),
                    ),
                  ),
                ),
              ),
            )
          : null,
    );
  }
}

class _ImagePage extends StatelessWidget {
  final String path;

  const _ImagePage({required this.path});

  @override
  Widget build(BuildContext context) {
    final file = File(path);
    if (!file.existsSync()) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.broken_image, size: 64, color: Colors.white54),
            SizedBox(height: 8),
            Text('Ảnh không tồn tại', style: TextStyle(color: Colors.white54)),
          ],
        ),
      );
    }

    return InteractiveViewer(
      minScale: 0.5,
      maxScale: 4.0,
      child: Center(
        child: Image.file(
          file,
          fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => const Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.broken_image, size: 64, color: Colors.white54),
              SizedBox(height: 8),
              Text('Không tải được ảnh', style: TextStyle(color: Colors.white54)),
            ],
          ),
        ),
      ),
    );
  }
}
