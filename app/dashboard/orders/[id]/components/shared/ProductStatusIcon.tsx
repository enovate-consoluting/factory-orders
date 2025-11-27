/**
 * Product Status Icon Utility
 * Returns appropriate icon component based on product status
 * Shared across all product cards
 * Last Modified: November 2025
 */

import React from 'react';
import { 
  CheckCircle, Package, Truck, AlertCircle, RotateCcw, 
  Clock, XCircle, Send, MessageSquare, Ship
} from 'lucide-react';

export function getProductStatusIcon(status: string) {
  const normalizedStatus = status || 'pending';
  
  switch (normalizedStatus) {
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'in_production':
      return <Package className="w-5 h-5 text-blue-500" />;
    case 'shipped':
    case 'in_transit':
      return <Truck className="w-5 h-5 text-purple-500" />;
    case 'sample_requested':
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    case 'revision_requested':
      return <RotateCcw className="w-5 h-5 text-orange-500" />;
    case 'pending_client_approval':
      return <Clock className="w-5 h-5 text-purple-500" />;
    case 'rejected':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'submitted_to_manufacturer':
    case 'sent_to_manufacturer':
      return <Send className="w-5 h-5 text-blue-500" />;
    case 'pending_admin':
      return <MessageSquare className="w-5 h-5 text-orange-500" />;
    default:
      return <Clock className="w-5 h-5 text-gray-500" />;
  }
}