/**
 * ArrivalAlertBar - Persistent notification banner for inventory arrivals
 * Shows when items have been checked into inventory
 * Per-user dismissal - each admin/super_admin sees their own notifications
 * Roles: Admin, Super Admin
 * Last Modified: January 2025
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Truck, X, ChevronDown, ChevronUp, ExternalLink, Package } from 'lucide-react';
import Link from 'next/link';

interface ArrivalNotification {
  id: string;
  inventory_id: string;
  product_name: string;
  order_number: string | null;
  client_name: string | null;
  received_at: string;
  received_by_name: string | null;
  rack_location: string | null;
  total_quantity: number;
}

interface User {
  id: string;
  role: string;
  name?: string;
}

export default function ArrivalAlertBar() {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<ArrivalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);

  // Check if user should see this bar (admin, super_admin, or system_admin only)
  const shouldShowBar = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'system_admin';

  // Fetch user from localStorage
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch {
        setUser(null);
      }
    }
  }, []);

  // Fetch undismissed notifications
  const fetchNotifications = useCallback(async () => {
    if (!user?.id || !shouldShowBar) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('arrival_notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('dismissed', false)
        .order('received_at', { ascending: false });

      if (error) {
        // Table might not exist yet - that's okay
        if (error.code === '42P01') {
          console.log('arrival_notifications table not yet created');
        } else {
          console.error('Error fetching arrival notifications:', error);
        }
        setNotifications([]);
      } else {
        setNotifications(data || []);
      }
    } catch (err) {
      console.error('Error fetching arrival notifications:', err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, shouldShowBar, supabase]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Dismiss all notifications
  const handleDismissAll = async () => {
    if (!user?.id || notifications.length === 0) return;

    setDismissing(true);
    try {
      const { error } = await supabase
        .from('arrival_notifications')
        .update({
          dismissed: true,
          dismissed_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('dismissed', false);

      if (error) {
        console.error('Error dismissing notifications:', error);
      } else {
        setNotifications([]);
        setExpanded(false);
      }
    } catch (err) {
      console.error('Error dismissing notifications:', err);
    } finally {
      setDismissing(false);
    }
  };

  // Dismiss a single notification
  const handleDismissOne = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('arrival_notifications')
        .update({
          dismissed: true,
          dismissed_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) {
        console.error('Error dismissing notification:', error);
      } else {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      }
    } catch (err) {
      console.error('Error dismissing notification:', err);
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  // Don't render if loading, no user, not admin, or no notifications
  if (loading || !shouldShowBar || notifications.length === 0) {
    return null;
  }

  const latestArrival = notifications[0];
  const latestTime = formatRelativeTime(latestArrival.received_at);

  return (
    <div className="bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg">
      {/* Main Bar - Double-click to toggle details */}
      <div
        className="px-4 py-2.5 cursor-pointer select-none"
        onDoubleClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Left: Icon + Message */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full flex-shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm sm:text-base">
                  {notifications.length} NEW ARRIVAL{notifications.length !== 1 ? 'S' : ''}
                </span>
                <span className="text-white/80 text-xs sm:text-sm">
                  Latest: {latestTime}
                </span>
              </div>
              {!expanded && (
                <p className="text-white/90 text-xs sm:text-sm truncate">
                  {latestArrival.product_name}
                  {latestArrival.client_name && ` - ${latestArrival.client_name}`}
                </p>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Expand/Collapse - More visible */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              {expanded ? (
                <>
                  <span className="hidden sm:inline">Hide Details</span>
                  <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">View Details</span>
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>

            {/* View Inventory Link - Opens in new window */}
            <a
              href="/dashboard/inventory"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              <Package className="w-4 h-4" />
              View Inventory
            </a>

            {/* Dismiss All - with confirmation */}
            {showDismissConfirm ? (
              <div className="flex items-center gap-1 bg-white/30 rounded-lg px-2 py-1">
                <span className="text-xs font-medium mr-1">Clear all?</span>
                <button
                  onClick={() => {
                    handleDismissAll();
                    setShowDismissConfirm(false);
                  }}
                  disabled={dismissing}
                  className="px-2 py-0.5 bg-white/30 hover:bg-white/50 rounded text-xs font-bold transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setShowDismissConfirm(false)}
                  className="px-2 py-0.5 hover:bg-white/20 rounded text-xs transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDismissConfirm(true)}
                disabled={dismissing}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                title="Dismiss All"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded List */}
      {expanded && (
        <div className="border-t border-white/20 bg-red-700/50 max-h-64 overflow-y-auto">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="px-4 py-2.5 border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {notification.product_name}
                    </span>
                    {notification.order_number && (
                      <span className="text-white/70 text-xs">
                        #{notification.order_number}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-white/80">
                    {notification.client_name && (
                      <span>{notification.client_name}</span>
                    )}
                    {notification.rack_location && (
                      <span>Rack: {notification.rack_location}</span>
                    )}
                    {notification.total_quantity > 0 && (
                      <span>Qty: {notification.total_quantity}</span>
                    )}
                    <span>{formatRelativeTime(notification.received_at)}</span>
                  </div>
                  {notification.received_by_name && (
                    <p className="text-xs text-white/60 mt-0.5">
                      Received by: {notification.received_by_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Link
                    href="/dashboard/inventory"
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    title="View in Inventory"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleDismissOne(notification.id)}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Footer with Dismiss All */}
          <div className="px-4 py-2 bg-red-800/50 flex items-center justify-between">
            <span className="text-xs text-white/70">
              {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleDismissAll}
              disabled={dismissing}
              className="text-xs font-medium hover:underline disabled:opacity-50"
            >
              {dismissing ? 'Dismissing...' : 'Dismiss All'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
