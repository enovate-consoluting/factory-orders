/**
 * Order Sample Request Component - UPGRADED WITH ROUTING
 * Order-level sample request with independent routing workflow
 * Routes: Admin ↔ Manufacturer, Admin ↔ Client (never Manufacturer ↔ Client)
 * FIX: Now syncs sample_workflow_status when sampleStatus changes
 * Last Modified: Nov 26 2025
 */

import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, Calendar, CreditCard, Upload, X, Save, Loader2, 
  Paperclip, History, Send, Building, User, CheckCircle, ArrowRight,
  Factory
} from 'lucide-react';
import { ACCEPTED_FILE_TYPES } from '@/lib/constants/fileUpload';

interface OrderSampleRequestProps {
  orderId?: string;
  sampleFee: string;
  sampleETA: string;
  sampleStatus: string;
  sampleNotes: string;
  sampleFiles?: File[];
  existingMedia?: any[];
  // NEW: Routing props
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
  onSave?: () => void;
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
  const [tempNotes, setTempNotes] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [originalNotes, setOriginalNotes] = useState(sampleNotes);
  
  // Route modal state
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeDestination, setRouteDestination] = useState<'manufacturer' | 'admin' | 'client' | null>(null);
  const [routeNotes, setRouteNotes] = useState('');

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

  // FIX: Handle status change and sync workflow status
  const handleStatusChange = (newStatus: string) => {
    // Update the sample status
    handleFieldChange('sampleStatus', newStatus);
    // Keep workflow status in sync with sample status
    onUpdate('sampleWorkflowStatus', newStatus);
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

  // Route modal handlers
  const openRouteModal = (destination: 'manufacturer' | 'admin' | 'client') => {
    setRouteDestination(destination);
    setRouteNotes('');
    setShowRouteModal(true);
  };

  const handleRoute = async () => {
    if (!routeDestination) return;
    
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
    }
  };

  const getRoutingStatusBadge = () => {
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

  const getWorkflowStatusBadge = () => {
    const statuses: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Pending' },
      sent_to_manufacturer: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Sent to Manufacturer' },
      priced_by_manufacturer: { bg: 'bg-green-100', text: 'text-green-700', label: 'Priced' },
      sent_to_client: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Sent to Client' },
      client_approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Client Approved' },
      client_rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Client Rejected' },
      in_production: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'In Production' },
      shipped: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Shipped' },
      delivered: { bg: 'bg-green-100', text: 'text-green-700', label: 'Delivered' },
      ready: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Ready' },
      approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' }
    };
    
    const status = statuses[sampleWorkflowStatus] || statuses.pending;
    
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

  return (
    <div className="bg-amber-50 rounded-lg p-4 border border-amber-300 mb-4">
      {/* Header with routing status */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-amber-900 flex items-center">
          <AlertCircle className="w-4 h-4 mr-2" />
          Order Sample Request / Technical Pack
        </h3>
        <div className="flex items-center gap-2">
          {/* Routing Status Badge */}
          {getRoutingStatusBadge()}
          
          {/* Workflow Status Badge */}
          {getWorkflowStatusBadge()}
          
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

      {/* ROUTING BUTTONS - Based on user role and current routing */}
      <div className="mb-4 p-3 bg-white rounded-lg border border-amber-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700">Sample Routing:</span>
          
          <div className="flex items-center gap-2">
            {/* Admin can send to Manufacturer */}
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
            
            {/* Admin can send to Client */}
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
            
            {/* Manufacturer/Client can send back to Admin */}
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
            
            {/* Show loading spinner if routing */}
            {isRouting && (
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            )}
            
            {/* Show message if no routing available */}
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

      {/* Sample Details Fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div className={!canEdit ? "opacity-60" : ""}>
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
              disabled={!canEdit}
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-amber-300 rounded bg-white text-gray-900 placeholder-gray-500 disabled:bg-amber-50 disabled:text-gray-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className={!canEdit ? "opacity-60" : ""}>
          <label className="block text-xs font-medium text-amber-800 mb-1">
            Sample ETA
          </label>
          <div className="relative">
            <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-amber-600" />
            <input
              type="date"
              value={sampleETA}
              onChange={(e) => handleFieldChange('sampleETA', e.target.value)}
              disabled={!canEdit}
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-amber-300 rounded bg-white text-gray-900 disabled:bg-amber-50 disabled:text-gray-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className={!canEdit ? "opacity-60" : ""}>
          <label className="block text-xs font-medium text-amber-800 mb-1">
            Status
          </label>
          <select
            value={sampleStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={!canEdit}
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

      {/* Notes Section */}
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