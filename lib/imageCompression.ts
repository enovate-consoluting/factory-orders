/**
 * Image Compression Utility
 * Client-side image compression to speed up uploads
 * Uses Canvas API for resizing and JPEG compression
 */

export interface CompressionOptions {
  maxWidth?: number;      // Max width in pixels (default: 1920)
  maxHeight?: number;     // Max height in pixels (default: 1920)
  quality?: number;       // JPEG quality 0-1 (default: 0.8)
  outputType?: string;    // Output MIME type (default: image/jpeg)
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  savedPercent: number;
  wasCompressed: boolean;
  dimensions: { width: number; height: number };
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  outputType: 'image/jpeg',
};

/**
 * Check if a file is an image that can be compressed
 */
export function isCompressibleImage(file: File): boolean {
  return file.type.startsWith('image/') && !file.type.includes('gif');
}

/**
 * Load an image file into an HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number; needsResize: boolean } {
  let newWidth = width;
  let newHeight = height;
  let needsResize = false;

  if (width > maxWidth) {
    newWidth = maxWidth;
    newHeight = Math.round((height * maxWidth) / width);
    needsResize = true;
  }

  if (newHeight > maxHeight) {
    newHeight = maxHeight;
    newWidth = Math.round((newWidth * maxHeight) / newHeight);
    needsResize = true;
  }

  return { width: newWidth, height: newHeight, needsResize };
}

/**
 * Convert canvas to File
 */
function canvasToFile(
  canvas: HTMLCanvasElement,
  originalName: string,
  mimeType: string,
  quality: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob from canvas'));
          return;
        }

        // Create new filename with appropriate extension
        const ext = mimeType === 'image/jpeg' ? '.jpg' : '.png';
        const baseName = originalName.replace(/\.[^/.]+$/, '');
        const newName = `${baseName}${ext}`;

        const file = new File([blob], newName, { type: mimeType });
        resolve(file);
      },
      mimeType,
      quality
    );
  });
}

/**
 * Compress a single image file
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = file.size;

  // Skip non-compressible images
  if (!isCompressibleImage(file)) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      savedBytes: 0,
      savedPercent: 0,
      wasCompressed: false,
      dimensions: { width: 0, height: 0 },
    };
  }

  try {
    // Load the image
    const img = await loadImage(file);
    const { width: newWidth, height: newHeight, needsResize } = calculateDimensions(
      img.width,
      img.height,
      opts.maxWidth,
      opts.maxHeight
    );

    // If image is small enough and already JPEG with reasonable size, skip
    const sizeThreshold = 500 * 1024; // 500KB
    if (!needsResize && file.type === 'image/jpeg' && file.size < sizeThreshold) {
      URL.revokeObjectURL(img.src);
      return {
        file,
        originalSize,
        compressedSize: originalSize,
        savedBytes: 0,
        savedPercent: 0,
        wasCompressed: false,
        dimensions: { width: img.width, height: img.height },
      };
    }

    // Create canvas and draw resized image
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Use high-quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    // Convert to file
    const compressedFile = await canvasToFile(
      canvas,
      file.name,
      opts.outputType,
      opts.quality
    );

    // Clean up
    URL.revokeObjectURL(img.src);

    const compressedSize = compressedFile.size;
    const savedBytes = originalSize - compressedSize;
    const savedPercent = Math.round((savedBytes / originalSize) * 100);

    // If compression made it bigger, use original
    if (compressedSize >= originalSize) {
      return {
        file,
        originalSize,
        compressedSize: originalSize,
        savedBytes: 0,
        savedPercent: 0,
        wasCompressed: false,
        dimensions: { width: img.width, height: img.height },
      };
    }

    return {
      file: compressedFile,
      originalSize,
      compressedSize,
      savedBytes,
      savedPercent,
      wasCompressed: true,
      dimensions: { width: newWidth, height: newHeight },
    };
  } catch (error) {
    console.error('[COMPRESS] Failed to compress image:', file.name, error);
    // Return original on error
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      savedBytes: 0,
      savedPercent: 0,
      wasCompressed: false,
      dimensions: { width: 0, height: 0 },
    };
  }
}

/**
 * Compress multiple images in parallel
 */
export async function compressImages(
  files: File[],
  options: CompressionOptions = {}
): Promise<{
  files: File[];
  results: CompressionResult[];
  totalOriginalSize: number;
  totalCompressedSize: number;
  totalSavedBytes: number;
}> {
  const results = await Promise.all(
    files.map((file) => compressImage(file, options))
  );

  const totalOriginalSize = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalCompressedSize = results.reduce((sum, r) => sum + r.compressedSize, 0);
  const totalSavedBytes = totalOriginalSize - totalCompressedSize;

  console.log(
    `[COMPRESS] Processed ${files.length} files: ` +
    `${formatSize(totalOriginalSize)} -> ${formatSize(totalCompressedSize)} ` +
    `(saved ${formatSize(totalSavedBytes)}, ${Math.round((totalSavedBytes / totalOriginalSize) * 100)}%)`
  );

  return {
    files: results.map((r) => r.file),
    results,
    totalOriginalSize,
    totalCompressedSize,
    totalSavedBytes,
  };
}

/**
 * Format file size for display
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
