/**
 * File Upload Display Component
 * Shows uploaded files with delete functionality and pending uploads
 * Shared across product cards
 * Last Modified: November 2025
 */

import React from 'react';
import { Paperclip, X, Upload, Loader2 } from 'lucide-react';

interface FileUploadDisplayProps {
  files: any[];
  pendingFiles?: File[];
  onFileClick: (url: string) => void;
  onDeleteFile?: (id: string) => void;
  onRemovePending?: (index: number) => void;
  title: string;
  fileCount?: boolean;
  loading?: boolean;
  onAddFiles?: () => void;
  translate?: (text: string | null | undefined) => string;
  t?: (key: string) => string;
}

export function FileUploadDisplay({
  files,
  pendingFiles = [],
  onFileClick,
  onDeleteFile,
  onRemovePending,
  title,
  fileCount = true,
  loading = false,
  onAddFiles,
  translate = (text) => text || '',
  t = (key) => key
}: FileUploadDisplayProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-700">
          {title} {fileCount && files.length > 0 && `(${files.length})`}
        </label>
        {onAddFiles && (
          <button 
            onClick={onAddFiles}
            disabled={loading}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            {t('addFiles')}
          </button>
        )}
      </div>
      
      {/* Existing Files */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {files.map((file) => (
            <div key={file.id} className="group relative inline-flex">
              <button
                onClick={() => onFileClick(file.file_url)}
                className="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center gap-1"
                title={file.display_name || file.original_filename || 'File'}
              >
                <Paperclip className="w-3 h-3" />
                <span>{file.display_name || file.original_filename || 'File'}</span>
              </button>
              {onDeleteFile && (
                <button
                  onClick={() => onDeleteFile(file.id)}
                  className="absolute -top-1 -right-1 p-0.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                  title="Delete file"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Pending Files */}
      {pendingFiles.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-700 mb-1">{t('filesToUpload')}:</p>
          <div className="flex flex-wrap gap-1">
            {pendingFiles.map((file, index) => (
              <div key={index} className="group relative inline-flex">
                <div className="px-2 py-1 bg-blue-100 border border-blue-300 rounded text-xs text-blue-800 flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  <span>{file.name}</span>
                </div>
                {onRemovePending && (
                  <button
                    onClick={() => onRemovePending(index)}
                    className="absolute -top-1 -right-1 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700"
                    title="Remove file"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {files.length === 0 && pendingFiles.length === 0 && (
        <p className="text-xs text-gray-500">{t('noMediaUploadedYet').replace('{title}', title.toLowerCase())}</p>
      )}
    </div>
  );
}