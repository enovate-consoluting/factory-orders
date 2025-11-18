/**
 * Order Sample Request Component
 * Order-level sample request section (replacing product-level)
 * Displays at the top of order details
 * Last Modified: November 2025
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, Calendar, CreditCard, Upload, X, Save, Loader2, Paperclip, History } from 'lucide-react';

interface OrderSampleRequestProps {
  sampleFee: string;
  sampleETA: string;
  sampleStatus: string;
  sampleNotes: string;
  sampleFiles?: File[];
  existingMedia?: any[];
  onUpdate: (field: string, value: any) => void;
  onFileUpload?: (files: FileList | null) => void;
  onFileRemove?: (index: number) => void;
  onExistingFileDelete?: (mediaId: string) => void;
  onViewHistory?: () => void;
  hasNewHistory?: boolean;
  isManufacturer?: boolean;
  readOnly?: boolean;
  onSave?: () => void;
  saving?: boolean;
}

export const OrderSampleRequest: React.FC<OrderSampleRequestProps> = ({
  sampleFee,
  sampleETA,
  sampleStatus,
  sampleNotes,
  sampleFiles = [],
  existingMedia = [],
  onUpdate,
  onFileUpload,
  onFileRemove,
  onExistingFileDelete,
  onViewHistory,
  hasNewHistory = false,
  isManufacturer = false,
  readOnly = false,
  onSave,
  saving = false
}) => {
  const [tempNotes, setTempNotes] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [originalNotes, setOriginalNotes] = useState(sampleNotes);

  // Debug log to see what we're receiving
  useEffect(() => {
    console.log('OrderSampleRequest - existingMedia:', existingMedia);
    console.log('OrderSampleRequest - existingMedia length:', existingMedia?.length);
  }, [existingMedia]);

  useEffect(() => {
    if (sampleNotes !== originalNotes && !tempNotes) {
      setOriginalNotes(sampleNotes);
      setTempNotes('');
    }
  }, [sampleNotes, originalNotes, tempNotes]);

  const handleFieldChange = (field: string, value: any) => {
    onUpdate(field, value);
    setIsDirty(true);
  };

  const handleNotesChange = (value: string) => {
    setTempNotes(value);
    onUpdate('sampleNotes', value);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (onSave) {
      await onSave();
      setIsDirty(false);
      setTempNotes('');
      setOriginalNotes(tempNotes || sampleNotes);
    }
  };

  const handleCancel = () => {
    setTempNotes('');
    setIsDirty(false);
    onUpdate('sampleNotes', originalNotes);
  };

  const handleFileClick = (fileUrl: string) => {
    window.open(fileUrl, '_blank');
  };

  const showSaveButton = isDirty || sampleFiles.length > 0;

  return (
    <div className="bg-amber-50 rounded-lg p-4 border border-amber-300 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-amber-900 flex items-center">
          <AlertCircle className="w-4 h-4 mr-2" />
          Order Sample Request / Technical Pack
        </h3>
        <div className="flex items-center gap-2">
          {existingMedia && existingMedia.length > 0 && (
            <span className="text-xs text-amber-700">
              {existingMedia.length} file(s)
            </span>
          )}
          {/* History button */}
          {onViewHistory && (
            <button
              onClick={onViewHistory}
              className="px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs font-medium flex items-center gap-1 relative"
              title="View sample history"
            >
              <History className="w-3 h-3" />
              <span className="hidden sm:inline">History</span>
              {hasNewHistory && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div className={!isManufacturer ? "opacity-60" : ""}>
          <label className="block text-xs font-medium text-amber-800 mb-1">
            Sample Fee
          </label>
          <div className="relative">
            <CreditCard className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-amber-600" />
            <input
              type="number"
              min="0"
              step="0.01"
              value={sampleFee}
              onChange={(e) => handleFieldChange('sampleFee', e.target.value)}
              placeholder={isManufacturer ? "Enter fee" : "Set by manufacturer"}
              disabled={!isManufacturer || readOnly}
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-amber-300 rounded bg-white text-gray-900 placeholder-gray-500 disabled:bg-amber-50 disabled:text-gray-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className={!isManufacturer ? "opacity-60" : ""}>
          <label className="block text-xs font-medium text-amber-800 mb-1">
            Sample ETA
          </label>
          <div className="relative">
            <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-amber-600" />
            <input
              type="date"
              value={sampleETA}
              onChange={(e) => handleFieldChange('sampleETA', e.target.value)}
              disabled={!isManufacturer || readOnly}
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-amber-300 rounded bg-white text-gray-900 disabled:bg-amber-50 disabled:text-gray-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className={!isManufacturer ? "opacity-60" : ""}>
          <label className="block text-xs font-medium text-amber-800 mb-1">
            Status
          </label>
          <select
            value={sampleStatus}
            onChange={(e) => handleFieldChange('sampleStatus', e.target.value)}
            disabled={!isManufacturer || readOnly}
            className="w-full px-2 py-1.5 text-sm border border-amber-300 rounded bg-white text-gray-900 disabled:bg-amber-50 disabled:text-gray-500 focus:ring-1 focus:ring-amber-500"
          >
            <option value="pending">Pending</option>
            <option value="in_production">In Production</option>
            <option value="ready">Ready</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-xs font-medium text-amber-800 mb-1">
          Sample Notes / Instructions
        </label>
        
        {sampleNotes && !tempNotes && (
          <div className="mb-2 p-2 bg-amber-100 rounded text-xs text-amber-800 border border-amber-200">
            <strong>Current notes:</strong>
            <div className="whitespace-pre-wrap mt-1">{sampleNotes}</div>
          </div>
        )}
        
        <textarea
          value={tempNotes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add notes about the sample request, special instructions, materials, colors, etc..."
          rows={2}
          disabled={readOnly}
          className="w-full px-2 py-1.5 text-sm border border-amber-300 rounded bg-white text-gray-900 font-medium placeholder-gray-500 disabled:bg-amber-50 focus:ring-1 focus:ring-amber-500"
        />
      </div>

      {existingMedia && existingMedia.length > 0 && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-amber-800 mb-1">
            Existing Sample Files
          </label>
          <div className="flex flex-wrap gap-1">
            {existingMedia.map((file: any) => (
              <div key={file.id} className="group relative inline-flex">
                <button
                  onClick={() => handleFileClick(file.file_url)}
                  className="px-2 py-1 bg-white border border-amber-300 rounded text-xs text-amber-700 hover:bg-amber-50 hover:border-amber-400 transition-colors flex items-center gap-1"
                  title={file.display_name || file.original_filename || 'Sample File'}
                >
                  <Paperclip className="w-3 h-3" />
                  <span>{file.display_name || file.original_filename || 'Sample File'}</span>
                </button>
                {!readOnly && onExistingFileDelete && (
                  <button
                    onClick={() => onExistingFileDelete(file.id)}
                    className="absolute -top-1 -right-1 p-0.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                    title="Delete file"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {onFileUpload && !readOnly && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-amber-800 mb-1">
            Upload New Technical Pack / Sample Media
          </label>
          <div className="flex items-center gap-2">
            <label className="px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 cursor-pointer flex items-center text-xs transition-colors">
              <Upload className="w-3 h-3 mr-1" />
              Upload Tech Pack
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
                onChange={(e) => {
                  onFileUpload(e.target.files);
                  setIsDirty(true);
                }}
                className="hidden"
              />
            </label>
            {sampleFiles.length > 0 && (
              <span className="text-xs text-amber-700">
                {sampleFiles.length} new file(s) to upload
              </span>
            )}
          </div>
          
          {sampleFiles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {sampleFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-1 bg-amber-100 px-2 py-1 rounded text-xs border border-amber-300">
                  <Upload className="w-3 h-3 text-amber-700" />
                  <span className="text-amber-800">{file.name}</span>
                  {onFileRemove && (
                    <button
                      onClick={() => {
                        onFileRemove(index);
                        if (sampleFiles.length === 1 && !tempNotes) {
                          setIsDirty(false);
                        }
                      }}
                      className="text-red-600 hover:text-red-800 ml-1"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showSaveButton && onSave && !readOnly && (
        <div className="flex justify-end gap-2 pt-3 border-t border-amber-200">
          <button
            onClick={handleCancel}
            disabled={saving}
            className="px-3 py-1.5 text-xs text-amber-700 hover:text-amber-900 border border-amber-300 rounded hover:bg-amber-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs hover:bg-amber-700 flex items-center gap-1 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-3 h-3" />
                Save Sample Section
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};