/**
 * Order Sample Request Component - FIXED VERSION
 * Order-level sample request with independent routing workflow
 * FIX: Now displays existing sample_notes from database
 * FIX: Shows saved notes above the "Add Note" input
 * Last Modified: November 30, 2025
 */

import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, Calendar, CreditCard, Upload, X, Save, Loader2, 
  Paperclip, History, Send, Building, User,
  Factory, Ban, MessageSquare
} from 'lucide-react';
import { ACCEPTED_FILE_TYPES } from '@/lib/constants/fileUpload';

// Data to pass to save function
interface SampleSaveData {
  fee: string;
  eta: string;
  status: string;
  notes: string;
}

interface OrderSampleRequestProps {
  orderId?: string;
  sampleFee: string;
  sampleETA: string;
  sampleStatus: string;
  sampleNotes: string;
  sampleFiles?: File[];
  existingMedia?: any[];
  // NEW: Existing notes from database to display
  existingSampleNotes?: string;
  // Routing props
  sampleRoutedTo?: 'admin' | 'manufacturer' | 'client';
  sampleWorkflowStatus?: string;
  // Routing callbacks
  onRouteToManufacturer?: (notes?: string) => Promise<boolean>;
  onRouteToAdmin?: (notes?: string) => Promise<boolean>;
  onRouteToClient?: (notes?: string) => Promise<boolean>;
  canRouteToManufacturer?: boolean;
  canRouteToAdmin?: boolean;
  canRouteToClient?: boolean;
  isRouting?: boolean;
  // Existing callbacks
  onUpdate: (field: string, value: any) => void;
  onFileUpload?: (files: FileList | null) => void;
  onFileRemove?: (index: number) => void;
  onExistingFileDelete?: (mediaId: string) => void;
  onViewHistory?: () => void;
  hasNewHistory?: boolean;
  isManufacturer?: boolean;
  isClient?: boolean;
  userRole?: string;
  readOnly?: boolean;
  onSave?: (data: SampleSaveData) => Promise<void>;
  saving?: boolean;
}

export const OrderSampleRequest: React.FC<OrderSampleRequestProps> = ({
  orderId,
  sampleFee,
  sampleETA,
  sampleStatus,
  sampleNotes,
  sampleFiles = [],
  existingMedia = [],
  existingSampleNotes = '',
  // Routing props
  sampleRoutedTo = 'admin',
  sampleWorkflowStatus = 'pending',
  onRouteToManufacturer,
  onRouteToAdmin,
  onRouteToClient,
  canRouteToManufacturer = false,
  canRouteToAdmin = false,
  canRouteToClient = false,
  isRouting = false,
  // Existing props
  onUpdate,
  onFileUpload,
  onFileRemove,
  onExistingFileDelete,
  onViewHistory,
  hasNewHistory = false,
  isManufacturer = false,
  isClient = false,
  userRole = 'admin',
  readOnly = false,
  onSave,
  saving = false
}) => {
  // LOCAL state for form fields
  const [localFee, setLocalFee] = useState(sampleFee);
  const [localETA, setLocalETA] = useState(sampleETA);
  const [localStatus, setLocalStatus] = useState(sampleStatus || 'no_sample');
  const [localNotes, setLocalNotes] = useState(''); // Always start empty for NEW notes
  const [isDirty, setIsDirty] = useState(false);
  
  // Route modal state
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeDestination, setRouteDestination] = useState<'manufacturer' | 'admin' | 'client' | null>(null);
  const [routeNotes, setRouteNotes] = useState('');

  // Sync local state when props change (on load/refetch)
  useEffect(() => {
    setLocalFee(sampleFee);
    setLocalETA(sampleETA);
    setLocalStatus(sampleStatus || 'no_sample');
    // Don't set localNotes - keep it empty for new input
    setIsDirty(false);
  }, [sampleFee, sampleETA, sampleStatus]);

  // Check if sample has any data
  const hasSampleData = (): boolean => {
    const hasFee = localFee && parseFloat(localFee) > 0;
    const hasETA = localETA && localETA.trim() !== '';
    const hasFiles = existingMedia.length > 0 || sampleFiles.length > 0;
    return hasFee || hasETA || hasFiles;
  };

  // Auto-detect status based on data
  const getAutoStatus = (): string => {
    if (!hasSampleData()) {
      return 'no_sample';
    }
    if (localStatus === 'no_sample') {
      return 'pending';
    }
    return localStatus;
  };

  const handleFeeChange = (value: string) => {
    setLocalFee(value);
    onUpdate('sampleFee', value);
    setIsDirty(true);
    
    if (value && parseFloat(value) > 0 && localStatus === 'no_sample') {
      setLocalStatus('pending');
      onUpdate('sampleStatus', 'pending');
    }
  };

  const handleETAChange = (value: string) => {
    setLocalETA(value);
    onUpdate('sampleETA', value);
    setIsDirty(true);
    
    if (value && localStatus === 'no_sample') {
      setLocalStatus('pending');
      onUpdate('sampleStatus', 'pending');
    }
  };

  const handleStatusChange = (value: string) => {
    setLocalStatus(value);
    onUpdate('sampleStatus', value);
    onUpdate('sampleWorkflowStatus', value);
    setIsDirty(true);
  };

  const handleNotesChange = (value: string) => {
    setLocalNotes(value);
    onUpdate('sampleNotes', value);
    setIsDirty(true);
  };

  // SAVE: Pass local values directly
  const handleSave = async () => {
    if (onSave) {
      const finalStatus = getAutoStatus();
      
      await onSave({
        fee: localFee,
        eta: localETA,
        status: finalStatus,
        notes: localNotes
      });
      setLocalNotes(''); // Clear notes after save
      setLocalStatus(finalStatus);
      setIsDirty(false);
    }
  };

  const handleCancel = () => {
    setLocalFee(sampleFee);
    setLocalETA(sampleETA);
    setLocalStatus(sampleStatus || 'no_sample');
    setLocalNotes('');
    setIsDirty(false);
  };

  const handleFileClick = (fileUrl: string) => {
    window.open(fileUrl, '_blank');
  };

  // Route modal handlers
  const openRouteModal = (destination: 'manufacturer' | 'admin' | 'client') => {
    setRouteDestination(destination);
    setRouteNotes('');
    setShowRouteModal(true);
  };

  const handleRoute = async () => {
    if (!routeDestination) return;
    
    // SAVE DATA FIRST before routing
    if (onSave) {
      const finalStatus = getAutoStatus();
      await onSave({
        fee: localFee,
        eta: localETA,
        status: finalStatus,
        notes: localNotes
      });
      setLocalNotes('');
      setLocalStatus(finalStatus);
    }
    
    // Then route
    let success = false;
    
    if (routeDestination === 'manufacturer' && onRouteToManufacturer) {
      success = await onRouteToManufacturer(routeNotes);
    } else if (routeDestination === 'admin' && onRouteToAdmin) {
      success = await onRouteToAdmin(routeNotes);
    } else if (routeDestination === 'client' && onRouteToClient) {
      success = await onRouteToClient(routeNotes);
    }
    
    if (success) {
      setShowRouteModal(false);
      setRouteNotes('');
      setRouteDestination(null);
      setIsDirty(false);
    }
  };

  // Check if sample is active
  const isSampleActive = localStatus !== 'no_sample' || hasSampleData();

  // Routing status badge
  const getRoutingStatusBadge = () => {
    if (localStatus === 'no_sample' && !hasSampleData()) {
      return (
        <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs font-medium flex items-center gap-1">
          <Ban className="w-3 h-3" />
          No Sample
        </span>
      );
    }
    
    const badges: Record<string, { bg: string; text: string; label: string; icon: any }> = {
      admin: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'With Admin', icon: User },
      manufacturer: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'With Manufacturer', icon: Factory },
      client: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'With Client', icon: Building }
    };
    
    const badge = badges[sampleRoutedTo] || badges.admin;
    const Icon = badge.icon;
    
    return (
      <span className={`px-2 py-1 ${badge.bg} ${badge.text} rounded text-xs font-medium flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  // Sample status badge
  const getSampleStatusBadge = () => {
    const statuses: Record<string, { bg: string; text: string; label: string }> = {
      no_sample: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'No Sample' },
      pending: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Pending' },
      in_production: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'In Production' },
      ready: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Ready' },
      shipped: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Shipped' },
      delivered: { bg: 'bg-green-100', text: 'text-green-700', label: 'Delivered' },
      sample_approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Sample Approved' },
      approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Sample Approved' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' }
    };
    
    const status = statuses[localStatus] || statuses.pending;
    
    if (localStatus === 'no_sample' && !hasSampleData()) {
      return null;
    }
    
    return (
      <span className={`px-2 py-1 ${status.bg} ${status.text} rounded text-xs font-medium`}>
        {status.label}
      </span>
    );
  };

  const showSaveButton = isDirty || sampleFiles.length > 0;
  
  // Determine if user can edit based on routing
  const canEdit = !readOnly && (
    (sampleRoutedTo === 'admin' && (userRole === 'admin' || userRole === 'super_admin')) ||
    (sampleRoutedTo === 'manufacturer' && isManufacturer) ||
    (sampleRoutedTo === 'client' && isClient)
  );
  
  // Fee and ETA: ONLY Manufacturer and Super Admin can edit
  const canEditFeeETA = !readOnly && (userRole === 'super_admin' || isManufacturer);
  
  const showRoutingButtons = isSampleActive;

  return (
    <div className={`rounded-lg p-4 border mb-4 ${
      isSampleActive ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'
    }`}>
      {/* Header with routing status */}
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold flex items-center ${
          isSampleActive ? 'text-amber-900' : 'text-gray-500'
        }`}>
          <AlertCircle className="w-4 h-4 mr-2" />
          Order Sample Request / Technical Pack
        </h3>
        <div className="flex items-center gap-2">
          {getRoutingStatusBadge()}
          {getSampleStatusBadge()}
          
          {existingMedia && existingMedia.length > 0 && (
            <span className="text-xs text-amber-700">
              {existingMedia.length} file(s)
            </span>
          )}
          
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

      {/* ROUTING BUTTONS */}
      {showRoutingButtons && (
        <div className="mb-4 p-3 bg-white rounded-lg border border-amber-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">Sample Routing:</span>
            
            <div className="flex items-center gap-2">
              {canRouteToManufacturer && (
                <button
                  onClick={() => openRouteModal('manufacturer')}
                  disabled={isRouting}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1 transition-colors"
                >
                  <Send className="w-3 h-3" />
                  Send to Manufacturer
                </button>
              )}
              
              {canRouteToClient && (
                <button
                  onClick={() => openRouteModal('client')}
                  disabled={isRouting}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 transition-colors"
                >
                  <Send className="w-3 h-3" />
                  Send to Client
                </button>
              )}
              
              {canRouteToAdmin && (
                <button
                  onClick={() => openRouteModal('admin')}
                  disabled={isRouting}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1 transition-colors"
                >
                  <Send className="w-3 h-3" />
                  {isManufacturer ? 'Send to Admin' : 'Return to Admin'}
                </button>
              )}
              
              {isRouting && (
                <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
              )}
              
              {!canRouteToManufacturer && !canRouteToClient && !canRouteToAdmin && (
                <span className="text-xs text-gray-500 italic">
                  {sampleRoutedTo === 'admin' && isManufacturer && 'Waiting for admin to send sample request'}
                  {sampleRoutedTo === 'admin' && isClient && 'Waiting for admin to send for approval'}
                  {sampleRoutedTo === 'manufacturer' && !isManufacturer && 'With manufacturer for pricing'}
                  {sampleRoutedTo === 'client' && !isClient && 'With client for approval'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sample Details Fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div className={!canEditFeeETA ? "opacity-60" : ""}>
          <label className="block text-xs font-medium text-amber-800 mb-1">
            Sample Fee
            {!canEditFeeETA && <span className="text-gray-500 font-normal ml-1">(Manufacturer only)</span>}
          </label>
          <div className="relative">
            <CreditCard className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-amber-600" />
            <input
              type="number"
              min="0"
              step="0.01"
              value={localFee}
              onChange={(e) => handleFeeChange(e.target.value)}
              placeholder={isManufacturer ? "Enter fee" : "Set by manufacturer"}
              disabled={!canEditFeeETA}
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-amber-300 rounded bg-white text-gray-900 placeholder-gray-500 disabled:bg-amber-50 disabled:text-gray-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className={!canEditFeeETA ? "opacity-60" : ""}>
          <label className="block text-xs font-medium text-amber-800 mb-1">
            Sample ETA
            {!canEditFeeETA && <span className="text-gray-500 font-normal ml-1">(Manufacturer only)</span>}
          </label>
          <div className="relative">
            <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-amber-600" />
            <input
              type="date"
              value={localETA}
              onChange={(e) => handleETAChange(e.target.value)}
              disabled={!canEditFeeETA}
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-amber-300 rounded bg-white text-gray-900 disabled:bg-amber-50 disabled:text-gray-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className={!canEdit ? "opacity-60" : ""}>
          <label className="block text-xs font-medium text-amber-800 mb-1">
            Status
          </label>
          <select
            value={localStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={!canEdit}
            className="w-full px-2 py-1.5 text-sm border border-amber-300 rounded bg-white text-gray-900 disabled:bg-amber-50 disabled:text-gray-500 focus:ring-1 focus:ring-amber-500"
          >
            <option value="no_sample">No Sample</option>
            <option value="pending">Pending</option>
            <option value="in_production">In Production</option>
            <option value="ready">Ready</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="sample_approved">Sample Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* EXISTING NOTES DISPLAY - NEW SECTION */}
      {existingSampleNotes && existingSampleNotes.trim() && (
        <div className="mb-3 p-3 bg-white rounded-lg border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-amber-600" />
            <h5 className="text-sm font-medium text-amber-800">Previous Notes</h5>
          </div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap bg-amber-50 p-2 rounded border border-amber-100">
            {existingSampleNotes}
          </div>
        </div>
      )}

      {/* ADD NEW NOTE Section */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-amber-800 mb-1">
          Add Note
          {onViewHistory && !existingSampleNotes && (
            <span className="text-gray-500 font-normal ml-2">(View previous notes in History)</span>
          )}
        </label>
        
        <textarea
          value={localNotes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add a note about the sample request..."
          rows={2}
          disabled={!canEdit}
          className="w-full px-2 py-1.5 text-sm border border-amber-300 rounded bg-white text-gray-900 font-medium placeholder-gray-500 disabled:bg-amber-50 focus:ring-1 focus:ring-amber-500"
        />
      </div>

      {/* Existing Files */}
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
                {canEdit && onExistingFileDelete && (
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

      {/* File Upload */}
      {onFileUpload && canEdit && (
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
                accept={ACCEPTED_FILE_TYPES}
                onChange={(e) => {
                  onFileUpload(e.target.files);
                  setIsDirty(true);
                  if (localStatus === 'no_sample') {
                    setLocalStatus('pending');
                    onUpdate('sampleStatus', 'pending');
                  }
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
                        if (sampleFiles.length === 1 && !localNotes) {
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

      {/* Save Button */}
      {showSaveButton && onSave && canEdit && (
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

      {/* ROUTE MODAL */}
      {showRouteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Send className="w-5 h-5 text-amber-600" />
              Route Sample Request
            </h3>
            
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Sending to:</span>
                <span className="font-semibold text-amber-800">
                  {routeDestination === 'manufacturer' && '🏭 Manufacturer'}
                  {routeDestination === 'admin' && '👤 Admin'}
                  {routeDestination === 'client' && '🏢 Client'}
                </span>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add a note (optional)
              </label>
              <textarea
                value={routeNotes}
                onChange={(e) => setRouteNotes(e.target.value)}
                placeholder={
                  routeDestination === 'manufacturer' 
                    ? "Instructions for manufacturer..." 
                    : routeDestination === 'client'
                    ? "Message for client..."
                    : "Notes for admin..."
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRouteModal(false);
                  setRouteNotes('');
                  setRouteDestination(null);
                }}
                disabled={isRouting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRoute}
                disabled={isRouting}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRouting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Routing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};