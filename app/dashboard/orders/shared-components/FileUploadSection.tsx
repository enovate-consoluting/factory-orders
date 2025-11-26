/**
 * File Upload Section Component
 * Reusable file upload with list display and remove functionality
 * Used for both sample and bulk media uploads
 * Last Modified: November 2025
 */

import React from 'react';
import { Upload, X } from 'lucide-react';
import { ACCEPTED_FILE_TYPES } from '@/lib/constants/fileUpload';

interface FileUploadSectionProps {
  label: string;
  files: File[];
  onUpload: (files: FileList | null) => void;
  onRemove: (index: number) => void;
  buttonText?: string;
  buttonClassName?: string;
  fileClassName?: string;
  accept?: string;
  multiple?: boolean;
}

export const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  label,
  files,
  onUpload,
  onRemove,
  buttonText = "Upload Files",
  buttonClassName = "bg-gray-100 text-gray-700 hover:bg-gray-200",
  fileClassName = "bg-gray-100 text-gray-700",
  accept = ACCEPTED_FILE_TYPES,
  multiple = true
}) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="flex items-center gap-4">
        <label className={`px-4 py-2 rounded-lg cursor-pointer flex items-center ${buttonClassName}`}>
          <Upload className="w-4 h-4 mr-2" />
          {buttonText}
          <input
            type="file"
            multiple={multiple}
            accept={accept}
            onChange={(e) => onUpload(e.target.files)}
            className="hidden"
          />
        </label>
        {files.length > 0 && (
          <span className="text-sm text-gray-600">
            {files.length} file(s) selected
          </span>
        )}
      </div>
      
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <div key={index} className={`flex items-center gap-2 px-3 py-1 rounded-lg ${fileClassName}`}>
              <span className="text-sm">{file.name}</span>
              <button
                onClick={() => onRemove(index)}
                className="text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};