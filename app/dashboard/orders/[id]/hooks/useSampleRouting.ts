/**
 * useSampleRouting Hook
 * Handles independent sample request routing
 * Routes: Admin ↔ Manufacturer, Admin ↔ Client (never Manufacturer ↔ Client)
 * 
 * UPDATED Dec 9, 2024:
 * - Added sampleApproved function to mark sample as approved
 * - Notes go to audit log only (not accumulated)
 * 
 * Last Modified: December 9, 2024
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface SampleRoutingState {
  routed_to: 'admin' | 'manufacturer' | 'client';
  workflow_status: string;
  routed_at: string | null;
  routed_by: string | null;
}

interface UseSampleRoutingReturn {
  routing: SampleRoutingState;
  isRouting: boolean;
  error: string | null;
  routeToManufacturer: (notes?: string) => Promise<boolean>;
  routeToAdmin: (notes?: string) => Promise<boolean>;
  routeToClient: (notes?: string) => Promise<boolean>;
  sampleApproved: (notes?: string) => Promise<boolean>;
  canRouteToManufacturer: boolean;
  canRouteToAdmin: boolean;
  canRouteToClient: boolean;
  canApproveSample: boolean;
}

export function useSampleRouting(
  orderId: string,
  currentRouting: SampleRoutingState,
  userRole: string,
  onUpdate: () => void
): UseSampleRoutingReturn {
  const [isRouting, setIsRouting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentUser = () => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      return {
        id: user.id || crypto.randomUUID(),
        name: user.name || user.email || 'Unknown User'
      };
    }
    return { id: crypto.randomUUID(), name: 'Unknown User' };
  };

  // ROUTING RULES:
  // - Admin can route to: Manufacturer, Client, or Approve
  // - Manufacturer can route to: Admin ONLY
  // - Client can route to: Admin ONLY (approve/reject)
  // - NEVER: Manufacturer ↔ Client direct

  const isAdminOrSuper = userRole === 'admin' || userRole === 'super_admin';

  const canRouteToManufacturer = 
    isAdminOrSuper && 
    currentRouting.routed_to === 'admin';

  const canRouteToAdmin = 
    (userRole === 'manufacturer' && currentRouting.routed_to === 'manufacturer') ||
    (userRole === 'client' && currentRouting.routed_to === 'client');

  const canRouteToClient = 
    isAdminOrSuper && 
    currentRouting.routed_to === 'admin';

  const canApproveSample = 
    isAdminOrSuper && 
    currentRouting.routed_to === 'admin';

  const routeSample = async (
    destination: 'admin' | 'manufacturer' | 'client',
    newStatus: string,
    notes?: string
  ): Promise<boolean> => {
    setIsRouting(true);
    setError(null);

    try {
      const user = getCurrentUser();
      const timestamp = new Date().toISOString();

      // Build update data - NO NOTES APPENDING
      const updateData: any = {
        sample_routed_to: destination,
        sample_routed_at: timestamp,
        sample_routed_by: user.id,
        sample_workflow_status: newStatus
      };

      // Update the order (without touching sample_notes)
      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Log routing action to audit (including notes if provided)
      const roleName = userRole === 'super_admin' ? 'Admin' : 
                      userRole.charAt(0).toUpperCase() + userRole.slice(1);
      
      await supabase.from('audit_log').insert({
        user_id: user.id,
        user_name: user.name,
        action_type: 'order_sample_updated',
        target_type: 'order',
        target_id: orderId,
        old_value: `routed_to: ${currentRouting.routed_to}`,
        new_value: notes && notes.trim() 
          ? `Routed to ${destination} | Note from ${roleName}: "${notes.trim()}"`
          : `Routed to ${destination}`,
        timestamp
      });

      // Create notification for recipient
      let notificationUserId: string | null = null;
      let notificationMessage = '';

      // Get order info for notification
      const { data: orderInfo } = await supabase
        .from('orders')
        .select('order_number, created_by, client_id, manufacturer_id')
        .eq('id', orderId)
        .single();

      if (orderInfo) {
        if (destination === 'admin') {
          notificationUserId = orderInfo.created_by;
          notificationMessage = `Sample request returned to admin for order ${orderInfo.order_number}`;
        } else if (destination === 'manufacturer') {
          // Get manufacturer user
          const { data: mfgUser } = await supabase
            .from('users')
            .select('id')
            .eq('manufacturer_id', orderInfo.manufacturer_id)
            .single();
          
          if (mfgUser) {
            notificationUserId = mfgUser.id;
            notificationMessage = `Sample request sent to you for order ${orderInfo.order_number}`;
          }
        } else if (destination === 'client') {
          // Get client user
          const { data: clientUser } = await supabase
            .from('users')
            .select('id')
            .eq('client_id', orderInfo.client_id)
            .single();
          
          if (clientUser) {
            notificationUserId = clientUser.id;
            notificationMessage = `Sample ready for your review on order ${orderInfo.order_number}`;
          }
        }

        if (notificationUserId) {
          await supabase.from('notifications').insert({
            user_id: notificationUserId,
            type: 'sample_routed',
            message: notificationMessage,
            order_id: orderId
          });
        }
      }

      onUpdate();
      return true;

    } catch (err: any) {
      console.error('Error routing sample:', err);
      setError(err.message || 'Failed to route sample');
      return false;
    } finally {
      setIsRouting(false);
    }
  };

  const routeToManufacturer = async (notes?: string) => {
    if (!canRouteToManufacturer) {
      setError('Cannot route to manufacturer from current state');
      return false;
    }
    return routeSample('manufacturer', 'sent_to_manufacturer', notes);
  };

  const routeToAdmin = async (notes?: string) => {
    if (!canRouteToAdmin) {
      setError('Cannot route to admin from current state');
      return false;
    }
    
    // Determine status based on who is sending
    let newStatus = 'pending_admin';
    if (userRole === 'manufacturer') {
      newStatus = 'priced_by_manufacturer';
    } else if (userRole === 'client') {
      newStatus = 'client_reviewed';
    }
    
    return routeSample('admin', newStatus, notes);
  };

  const routeToClient = async (notes?: string) => {
    if (!canRouteToClient) {
      setError('Cannot route to client from current state');
      return false;
    }
    return routeSample('client', 'sent_to_client', notes);
  };

  /**
   * Mark sample as approved
   * Only admin/super_admin can approve when sample is with them
   */
  const sampleApproved = async (notes?: string): Promise<boolean> => {
    if (!canApproveSample) {
      setError('Cannot approve sample from current state');
      return false;
    }

    setIsRouting(true);
    setError(null);

    try {
      const user = getCurrentUser();
      const timestamp = new Date().toISOString();

      // Update order with approved status
      // Sample stays with admin but status changes to approved
      const updateData: any = {
        sample_status: 'sample_approved',
        sample_workflow_status: 'sample_approved',
        sample_routed_at: timestamp,
        sample_routed_by: user.id
        // sample_routed_to stays as 'admin' - sample doesn't move
      };

      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Log to audit
      const roleName = userRole === 'super_admin' ? 'Admin' : 'Admin';
      
      await supabase.from('audit_log').insert({
        user_id: user.id,
        user_name: user.name,
        action_type: 'order_sample_approved',
        target_type: 'order',
        target_id: orderId,
        old_value: `status: ${currentRouting.workflow_status}`,
        new_value: notes && notes.trim() 
          ? `Sample Approved | Note from ${roleName}: "${notes.trim()}"`
          : 'Sample Approved',
        timestamp
      });

      // Get order info for notification
      const { data: orderInfo } = await supabase
        .from('orders')
        .select('order_number, manufacturer_id')
        .eq('id', orderId)
        .single();

      // Notify manufacturer that sample was approved
      if (orderInfo) {
        const { data: mfgUser } = await supabase
          .from('users')
          .select('id')
          .eq('manufacturer_id', orderInfo.manufacturer_id)
          .single();

        if (mfgUser) {
          await supabase.from('notifications').insert({
            user_id: mfgUser.id,
            type: 'sample_approved',
            message: `Sample approved for order ${orderInfo.order_number}`,
            order_id: orderId
          });
        }
      }

      onUpdate();
      return true;

    } catch (err: any) {
      console.error('Error approving sample:', err);
      setError(err.message || 'Failed to approve sample');
      return false;
    } finally {
      setIsRouting(false);
    }
  };

  return {
    routing: currentRouting,
    isRouting,
    error,
    routeToManufacturer,
    routeToAdmin,
    routeToClient,
    sampleApproved,
    canRouteToManufacturer,
    canRouteToAdmin,
    canRouteToClient,
    canApproveSample
  };
}