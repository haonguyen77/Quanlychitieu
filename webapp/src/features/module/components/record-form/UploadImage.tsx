import { useState, useRef, useCallback } from 'react';
import { Icon } from '@/shared/components/ui/Icon';

interface UploadImageProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export function UploadImage({ images, onChange, maxImages = 5 }: UploadImageProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const newImages = Array.from(files)
      .filter((f) => f.type.startsWith('image/') || f.type === 'image/webp')
      .slice(0, maxImages - images.length)
      .map((f) => f.name);
    if (newImages.length > 0) {
      onChange([...images, ...newImages]);
    }
  }, [images, onChange, maxImages]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-700">Hinh anh</label>
        <span className="text-[10px] text-gray-400">{images.length}/{maxImages} anh</span>
      </div>

      {/* Drop zone */}
      <div
        className={`flex items-center rounded-xl border-2 border-dashed transition-all duration-200 ${
          isDragging
            ? 'border-[#22C55E] bg-green-50/50 scale-[1.01]'
            : 'border-[#E5E7EB] bg-gray-50/50 hover:border-gray-300'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Left: Drag area */}
        <div className="flex-1 flex flex-col items-center justify-center py-4 px-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1.5 transition-colors duration-200 ${
            isDragging ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            <Icon name="image" size={16} color={isDragging ? '#22C55E' : '#9CA3AF'} />
          </div>
          <p className="text-xs text-gray-600 font-medium">Chon anh hoac keo vao day</p>
          <p className="text-[10px] text-gray-400 mt-0.5">JPG, PNG, WEBP (Max 5MB)</p>
        </div>

        {/* Right: Add button */}
        <div className="border-l border-dashed border-[#E5E7EB] px-4 py-4 flex flex-col items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-8 h-8 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-gray-500 hover:border-[#22C55E] hover:text-[#22C55E] hover:shadow-sm transition-all duration-200"
          >
            <Icon name="plus" size={14} />
          </button>
          <span className="text-[10px] text-gray-500 font-medium">Them anh</span>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Image thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div
              key={i}
              className="group relative flex items-center gap-2 px-3 py-2 bg-gray-50 border border-[#E5E7EB] rounded-lg text-xs text-gray-600 transition-all duration-200 hover:shadow-sm"
            >
              <Icon name="image" size={14} className="text-gray-400" />
              <span className="max-w-[120px] truncate">{img}</span>
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="ml-1 text-gray-400 hover:text-red-500 transition-colors duration-200"
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
