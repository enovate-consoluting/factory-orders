'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Notification, User } from '@/app/types/database';

// Fix: Don't extend Notification, define the full interface
interface NotificationWithRelations {
  id: string;
  user_id: string;
  order_id?: string;
  order_product_id?: string;
  type: 'new_order' | 'product_update' | 'sample_ready' | 'approval_needed';
  is_read: boolean;
  message: string;
  created_at: string;
  order?: {
    order_number: string;
  };
  order_product?: {
    product_order_number: string;
    product?: {
      title: string;
    };
  };
}

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<NotificationWithRelations[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          order:orders(order_number),
          order_product:order_products(
            product_order_number,
            product:products(title)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      setNotifications(data || []);
      const unread = data?.filter(n => !n.is_read).length || 0;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error in fetchNotifications:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error in markAsRead:', error);
    }
  }, [supabase]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all as read:', error);
        return;
      }

      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error in markAllAsRead:', error);
    }
  }, [userId, supabase]);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!userId) return;

    // Fetch initial notifications
    fetchNotifications();

    // Set up real-time subscription
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('New notification:', payload);
          
          // Fetch the complete notification with relations
          const { data } = await supabase
            .from('notifications')
            .select(`
              *,
              order:orders(order_number),
              order_product:order_products(
                product_order_number,
                product:products(title)
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setNotifications(prev => [data, ...prev]);
            if (!data.is_read) {
              setUnreadCount(prev => prev + 1);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Updated notification:', payload);
          setNotifications(prev =>
            prev.map(n =>
              n.id === payload.new.id
                ? { ...n, ...payload.new }
                : n
            )
          );
          
          // Recalculate unread count
          setNotifications(prev => {
            const unread = prev.filter(n => !n.is_read).length;
            setUnreadCount(unread);
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}

// Helper function to create notifications
export async function createNotification(
  supabase: any,
  {
    user_id,
    order_id,
    order_product_id,
    type,
    message,
  }: {
    user_id: string;
    order_id?: string;
    order_product_id?: string;
    type: 'new_order' | 'product_update' | 'sample_ready' | 'approval_needed';
    message: string;
  }
) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id,
        order_id,
        order_product_id,
        type,
        message,
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in createNotification:', error);
    return null;
  }
}

// Helper to get notification message
export function getNotificationMessage(notification: NotificationWithRelations): string {
  const orderNumber = notification.order?.order_number || 'Unknown';
  const productTitle = notification.order_product?.product?.title || 'Unknown Product';

  const templates = {
    new_order: `New order ${orderNumber} has been submitted for review`,
    product_update: `Product "${productTitle}" in order ${orderNumber} has been updated`,
    sample_ready: `Sample for "${productTitle}" in order ${orderNumber} is ready for review`,
    approval_needed: `Order ${orderNumber} requires your approval`,
  };

  return templates[notification.type] || notification.message;
}

// Helper to get notification icon
export function getNotificationIcon(type: string) {
  const icons: Record<string, string> = {
    new_order: '📦',
    product_update: '🔄',
    sample_ready: '✅',
    approval_needed: '⚠️',
  };
  return icons[type] || '📬';
}

// Helper to format notification time
export function formatNotificationTime(createdAt: string): string {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}