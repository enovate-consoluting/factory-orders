// app/dashboard/orders/[id]/components/modals/HistoryModal.tsx - COMPLETE VERSION WITH DETAILED DISPLAY

import React, { useState, useEffect } from 'react';
import { X, Calendar, User, History, Clock, FileText, Package, Send, DollarSign, AlertCircle, Upload, StickyNote, CalendarDays, Trash2, Edit } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
}

interface HistoryItem {
  id: string;
  user_name: string;
  action_type: string;
  old_value: string;
  new_value: string;
  timestamp: string;
  target_id: string;
  target_type: string;
}

export function HistoryModal({ isOpen, onClose, productId, productName }: HistoryModalProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && productId) {
      fetchHistory();
    }
  }, [isOpen, productId]);

  const fetchHistory = async () => {
    setLoading(true);
    console.log('Fetching history for:', productId, productName);
    
    try {
      // Check if this is for order-level sample history
      if (productId.startsWith('order-sample-')) {
        // Extract the order ID
        const orderId = productId.replace('order-sample-', '');
        
        console.log('Fetching order sample history for order:', orderId);
        
        // Fetch order-level audit logs - FIXED QUERY
        const { data, error } = await supabase
          .from('audit_log')
          .select('*')
          .eq('target_id', orderId)
          .eq('target_type', 'order')
          .eq('action_type', 'order_sample_updated')
          .order('timestamp', { ascending: false });

        if (error) {
          console.error('Error fetching order sample history:', error);
          throw error;
        }
        
        console.log('Order sample history data:', data);
        setHistory(data || []);
      } else {
        // Regular product history fetch
        const { data, error } = await supabase
          .from('audit_log')
          .select('*')
          .eq('target_id', productId)
          .eq('target_type', 'order_product')
          .order('timestamp', { ascending: false });

        if (error) throw error;
        console.log('Product history data:', data);
        setHistory(data || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatActionType = (action: string) => {
    const actionLabels: Record<string, string> = {
      'order_sample_updated': 'Sample Request Updated',
      'sample_section_updated': 'Sample Section Updated',
      'bulk_section_updated': 'Bulk Order Section Updated',
      'manufacturer_pricing_updated': 'Pricing Updated',
      'product_routed_send_to_production': 'Sent to Production',
      'product_routed_send_to_admin': 'Sent to Admin',
      'product_routed_in_production': 'Marked In Production',
      'product_routed_request_sample': 'Sample Requested',
      'product_routed_send_for_approval': 'Sent for Client Approval',
      'product_routed_send_back_to_manufacturer': 'Sent Back to Manufacturer',
      'product_routed_send_back_to_admin': 'Sent to Admin',
      'product_routed_approve_for_production': 'Approved for Production',
      'product_routed_shipped': 'Marked as Shipped',
      'product_locked': 'Product Locked',
      'product_unlocked': 'Product Unlocked',
      'product_status_changed': 'Status Changed',
      'routing_note': 'Routing Instructions',
      'note_added': 'Note Added',
      'sample_note_added': 'Sample Note Added',
      'bulk_note_added': 'Bulk Note Added',
      'sample_note_updated': 'Sample Note Updated',
      'media_deleted': 'Media Deleted',
      'media_uploaded': 'Media Uploaded',
      'shipping_method_selected': 'Shipping Method Selected',
      'shipping_method_changed': 'Shipping Method Changed'
    };
    return actionLabels[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getActionIcon = (action: string) => {
    if (action === 'order_sample_updated') return <AlertCircle className="w-3.5 h-3.5 text-amber-600" />;
    if (action.includes('sample_section')) return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />;
    if (action.includes('bulk_section')) return <Package className="w-3.5 h-3.5 text-blue-500" />;
    if (action.includes('pricing')) return <DollarSign className="w-3.5 h-3.5 text-green-500" />;
    if (action.includes('note')) return <FileText className="w-3.5 h-3.5 text-blue-500" />;
    if (action.includes('routed')) return <Send className="w-3.5 h-3.5 text-green-500" />;
    if (action.includes('status')) return <Package className="w-3.5 h-3.5 text-purple-500" />;
    if (action.includes('shipping')) return <Package className="w-3.5 h-3.5 text-cyan-500" />;
    return <Clock className="w-3.5 h-3.5 text-gray-500" />;
  };

  const formatOrderSampleUpdate = (newValue: string) => {
    // Parse the update string with pipe separators for detailed changes
    const parts: React.ReactElement[] = [];  // FIXED: Changed from JSX.Element[] to React.ReactElement[]
    
    // Split by pipe for multiple changes
    const changes = newValue.split(' | ');
    
    changes.forEach((change, index) => {
      // Fee changes
      if (change.includes('Fee:') || change.includes('Fee set to')) {
        const isRemoval = change.includes('→ $0') || change.includes('removed');
        parts.push(
          <div key={`fee-${index}`} className="flex items-start gap-2 text-sm text-gray-700">
            <DollarSign className={`w-3 h-3 ${isRemoval ? 'text-red-600' : 'text-green-600'} mt-0.5`} />
            <span>{change}</span>
          </div>
        );
      } else if (change.includes('Fee removed')) {
        parts.push(
          <div key={`fee-${index}`} className="flex items-start gap-2 text-sm text-gray-700">
            <DollarSign className="w-3 h-3 text-red-600 mt-0.5" />
            <span>{change}</span>
          </div>
        );
      }
      // Status changes
      else if (change.includes('Status:') || change.includes('Status changed to')) {
        parts.push(
          <div key={`status-${index}`} className="flex items-start gap-2 text-sm text-gray-700">
            <AlertCircle className="w-3 h-3 text-blue-600 mt-0.5" />
            <span>{change}</span>
          </div>
        );
      }
      // ETA changes
      else if (change.includes('ETA:') || change.includes('ETA set to')) {
        const isRemoval = change.includes('not set') || change.includes('removed');
        parts.push(
          <div key={`eta-${index}`} className="flex items-start gap-2 text-sm text-gray-700">
            <CalendarDays className={`w-3 h-3 ${isRemoval ? 'text-red-600' : 'text-purple-600'} mt-0.5`} />
            <span>{change}</span>
          </div>
        );
      } else if (change.includes('ETA removed')) {
        parts.push(
          <div key={`eta-${index}`} className="flex items-start gap-2 text-sm text-gray-700">
            <CalendarDays className="w-3 h-3 text-red-600 mt-0.5" />
            <span>{change}</span>
          </div>
        );
      }
      // Notes changes - show actual content
      else if (change.includes('Notes') || change.includes('notes')) {
        const isRemoval = change.includes('removed');
        parts.push(
          <div key={`notes-${index}`} className="flex items-start gap-2 text-sm text-gray-700">
            <StickyNote className={`w-3 h-3 ${isRemoval ? 'text-red-600' : 'text-amber-600'} mt-0.5`} />
            <div className="flex-1">
              <div>{change}</div>
            </div>
          </div>
        );
      }
      // File uploads - show file names
      else if (change.includes('file(s) uploaded') || change.includes('Files uploaded')) {
        parts.push(
          <div key={`files-${index}`} className="flex items-start gap-2 text-sm text-gray-700">
            <Upload className="w-3 h-3 text-indigo-600 mt-0.5" />
            <span>{change}</span>
          </div>
        );
      }
      // File removal
      else if (change.includes('File removed:')) {
        parts.push(
          <div key={`file-remove-${index}`} className="flex items-start gap-2 text-sm text-gray-700">
            <Trash2 className="w-3 h-3 text-red-600 mt-0.5" />
            <span>{change}</span>
          </div>
        );
      }
      // Default case
      else if (change) {
        parts.push(
          <div key={`default-${index}`} className="flex items-start gap-2 text-sm text-gray-700">
            <Edit className="w-3 h-3 text-gray-600 mt-0.5" />
            <span>{change}</span>
          </div>
        );
      }
    });
    
    // If no specific changes were parsed, show the raw message
    if (parts.length === 0) {
      parts.push(
        <div key="default" className="text-sm text-gray-600">
          {newValue}
        </div>
      );
    }
    
    return (
      <div className="mt-1 bg-amber-50 border border-amber-200 p-2 rounded space-y-2">
        {parts}
      </div>
    );
  };

  const formatDetailedChanges = (newValue: string, actionType: string) => {
    // For order sample updates - use special formatting
    if (actionType === 'order_sample_updated' && newValue) {
      return formatOrderSampleUpdate(newValue);
    }
    
    // For section updates, parse the changes
    if (actionType === 'sample_section_updated' || actionType === 'bulk_section_updated') {
      if (newValue && newValue.includes('→')) {
        const changes = newValue.split(', ');
        return (
          <div className="mt-1 text-sm bg-amber-50 border border-amber-200 p-2 rounded">
            <div className="space-y-1">
              {changes.map((change, idx) => (
                <div key={idx} className="text-gray-700">
                  {change}
                </div>
              ))}
            </div>
          </div>
        );
      }
    }
    
    // For shipping method changes
    if (actionType === 'shipping_method_changed' && newValue) {
      return (
        <div className="mt-1 text-sm bg-cyan-50 border border-cyan-200 p-2 rounded">
          <div className="text-gray-700">
            Changed to: <span className="font-medium capitalize">{newValue}</span> shipping
          </div>
        </div>
      );
    }
    
    // For regular notes, just display the note
    if (actionType.includes('note') && newValue) {
      if (newValue.startsWith('{') || newValue.startsWith('[')) {
        return null; // Hide JSON data
      }
      
      // Extract the actual note content if it's in quotes
      let noteContent = newValue;
      if (newValue.includes('"')) {
        const match = newValue.match(/"([^"]*)"/);
        if (match) {
          noteContent = match[1];
        }
      }
      
      return (
        <div className="mt-1 text-sm text-gray-600 bg-gray-50 p-2 rounded">
          {noteContent}
        </div>
      );
    }
    
    return null;
  };

  // Check if value is JSON
  const isJSON = (str: string) => {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  };

  // Determine if we're showing order sample history
  const isOrderSampleHistory = productId.startsWith('order-sample-');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-4 sm:p-6 max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4 border-b pb-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {isOrderSampleHistory ? 'Order Sample History' : 'History Log'}
            </h2>
            <span className="text-sm text-gray-500">
              - {productName}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">
                {isOrderSampleHistory 
                  ? 'No sample updates recorded yet' 
                  : 'No activity yet'}
              </p>
              {isOrderSampleHistory && (
                <p className="text-xs text-gray-400 mt-2">
                  Updates will appear here when you save changes to the sample request
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((entry) => {
                const actionLabel = formatActionType(entry.action_type);
                const hasDetailedChanges = entry.new_value && entry.new_value.includes('→');
                const isNote = entry.action_type?.includes('note');
                
                // Skip entries that only have JSON data in old_value
                if (isJSON(entry.old_value || '') && !entry.new_value) {
                  return null;
                }

                return (
                  <div key={entry.id} className="border-b border-gray-100 pb-2 last:border-0">
                    <div className="flex items-start gap-2">
                      {/* Icon */}
                      <div className="mt-1">
                        {getActionIcon(entry.action_type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Action and User on same line */}
                        <div className="flex items-baseline justify-between gap-2">
                          <div>
                            <span className="font-semibold text-sm text-gray-900">
                              {actionLabel}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">
                              by {entry.user_name || 'Unknown User'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        
                        {/* Display detailed changes or note content */}
                        {formatDetailedChanges(entry.new_value, entry.action_type)}
                        
                        {/* For status changes that aren't section updates */}
                        {!hasDetailedChanges && !isNote && entry.old_value && entry.new_value && !isJSON(entry.old_value) && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {entry.old_value} → {entry.new_value}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t pt-3 mt-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}