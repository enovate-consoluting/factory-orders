/**
 * File Upload Constants
 * Shared configuration for file uploads across the application
 * Location: lib/constants/fileUpload.ts
 * Last Modified: Nov 26 2025
 */

/**
 * Accepted file types for general uploads (products, samples, tech packs)
 * Includes: AI files, documents, spreadsheets, presentations, images, videos
 */
export const ACCEPTED_FILE_TYPES = ".ai,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*,video/*,application/illustrator,application/postscript";

/**
 * Accepted file types for image-only uploads (thumbnails, previews)
 */
export const ACCEPTED_IMAGE_TYPES = "image/*";

/**
 * Accepted file types for media uploads (images and videos)
 */
export const ACCEPTED_MEDIA_TYPES = "image/*,video/*";

/**
 * Maximum file size in megabytes
 */
export const MAX_FILE_SIZE_MB = 1024;

/**
 * Maximum file size in bytes (for validation)
 */
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024; // 1GB = 1,073,741,824 bytes

/**
 * Helper function to validate file size
 */
export const isFileSizeValid = (file: File): boolean => {
  return file.size <= MAX_FILE_SIZE_BYTES;
};

/**
 * Helper function to format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get human-readable max file size
 */
export const getMaxFileSizeDisplay = (): string => {
  return `${MAX_FILE_SIZE_MB}MB`;
};
