// app/dashboard/orders/[id]/components/modals/HistoryModal.tsx - FIXED VERSION

import React, { useState, useEffect } from 'react';
import { X, Calendar, User, History, Clock, FileText, Package, Send, DollarSign, AlertCircle } from 'lucide-react';
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
}

export function HistoryModal({ isOpen, onClose, productId, productName }: HistoryModalProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && productId) {
      fetchHistory();
    }
  }, [isOpen, productId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('target_id', productId)
        .eq('target_type', 'order_product')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatActionType = (action: string) => {
    const actionLabels: Record<string, string> = {
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
      'shipping_method_selected': 'Shipping Method Selected'
    };
    return actionLabels[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getActionIcon = (action: string) => {
    if (action.includes('sample_section')) return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />;
    if (action.includes('bulk_section')) return <Package className="w-3.5 h-3.5 text-blue-500" />;
    if (action.includes('pricing')) return <DollarSign className="w-3.5 h-3.5 text-green-500" />;
    if (action.includes('note')) return <FileText className="w-3.5 h-3.5 text-blue-500" />;
    if (action.includes('routed')) return <Send className="w-3.5 h-3.5 text-green-500" />;
    if (action.includes('status')) return <Package className="w-3.5 h-3.5 text-purple-500" />;
    return <Clock className="w-3.5 h-3.5 text-gray-500" />;
  };

  const formatDetailedChanges = (newValue: string, actionType: string) => {
    // For section updates, parse the changes
    if (actionType === 'sample_section_updated' || actionType === 'bulk_section_updated') {
      // Check if it contains the arrow format we expect
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
    
    // For regular notes, just display the note
    if (actionType.includes('note') && newValue) {
      // Don't show JSON, only show readable text
      if (newValue.startsWith('{') || newValue.startsWith('[')) {
        return null; // Hide JSON data
      }
      return (
        <div className="mt-1 text-sm text-gray-600 bg-gray-50 p-2 rounded">
          {newValue}
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-4 sm:p-6 max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4 border-b pb-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              History Log
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
              <p className="text-gray-500 text-sm">No activity yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((entry, index) => {
                const actionLabel = formatActionType(entry.action_type);
                const hasDetailedChanges = entry.new_value && entry.new_value.includes('→');
                const isNote = entry.action_type?.includes('note');
                
                // Skip entries that only have JSON data in old_value
                if (isJSON(entry.old_value) && !entry.new_value) {
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