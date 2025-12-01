'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutGrid,
  ShoppingCart, 
  Package,
  Layers,
  Activity,
  Users,
  UserCheck,
  Building2,
  Factory,
  LogOut,
  Bell,
  X,
  Mail,
  Menu,
  FileText,
  AlertCircle,
  DollarSign,
  Settings
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface NotificationCount {
  orders: number;
  products: number;
  total: number;
  // Manufacturer specific
  samples?: number;
  production?: number;
}

interface ManufacturerNotification {
  id: string;
  order_id: string;
  product_id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [notificationCounts, setNotificationCounts] = useState<NotificationCount>({ 
    orders: 0, 
    products: 0,
    total: 0,
    samples: 0,
    production: 0
  });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [manufacturerId, setManufacturerId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }

    let cleanup: (() => void) | undefined;

    try {
      const parsedUser = JSON.parse(userData);
      console.log('Logged in user:', parsedUser);
      setUser(parsedUser);

      // Load notifications based on role
      if (parsedUser.role === 'manufacturer') {
        console.log('User is manufacturer, loading manufacturer data...');
        loadManufacturerData(parsedUser).then((cleanupFn) => {
          cleanup = cleanupFn;
        });
      } else if (parsedUser.role === 'client') {
        console.log('User is client, loading client data...');
        loadClientData(parsedUser);
      } else if (parsedUser.id) {
        loadNotificationCounts(parsedUser.id);
        cleanup = subscribeToNotifications(parsedUser.id);
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [router]);

  // Load client specific data
  const loadClientData = async (user: User) => {
    try {
      console.log('Loading client data for email:', user.email);

      // Get client ID from clients table using email
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, name, email')
        .eq('email', user.email)
        .single();

      console.log('Client query result:', client, 'Error:', clientError);

      if (!client) {
        console.error('No client found for email:', user.email);
        return;
      }

      console.log('Found client ID:', client.id);
      setClientId(client.id);

      // Load client notifications (pending products count)
      await loadClientNotifications(client.id);
    } catch (error) {
      console.error('Error loading client data:', error);
    }
  };

  const loadClientNotifications = async (clientId: string) => {
    try {
      console.log('Loading notifications for client ID:', clientId);
      
      // Get orders for this client
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_products(
            id,
            product_status,
            routed_to
          )
        `)
        .eq('client_id', clientId);

      if (error) {
        console.error('Error loading client orders:', error);
        return;
      }

      // Count pending products
      let pendingCount = 0;
      orders?.forEach(order => {
        const clientProducts = order.order_products?.filter((p: any) => 
          p.routed_to === 'client' && p.product_status === 'pending_client_approval'
        ) || [];
        pendingCount += clientProducts.length;
      });

      console.log('Client pending products count:', pendingCount);

      setNotificationCounts({
        orders: pendingCount,
        products: 0,
        total: pendingCount,
        samples: 0,
        production: 0
      });
    } catch (error) {
      console.error('Error loading client notifications:', error);
    }
  };

  // Load manufacturer specific data
  const loadManufacturerData = async (user: User) => {
    try {
      console.log('Loading manufacturer data for email:', user.email);

      // Get manufacturer ID from manufacturers table using email
      const { data: manufacturer, error: manError } = await supabase
        .from('manufacturers')
        .select('id, name, email')
        .eq('email', user.email)
        .single();

      console.log('Manufacturer query result:', manufacturer, 'Error:', manError);

      if (!manufacturer) {
        console.error('No manufacturer found for email:', user.email);
        return;
      }

      console.log('Found manufacturer ID:', manufacturer.id);
      setManufacturerId(manufacturer.id);

      // Load manufacturer notifications
      await loadManufacturerNotifications(manufacturer.id);

      // Subscribe to real-time updates and return cleanup function
      const subscriptionCleanup = subscribeToManufacturerNotifications(manufacturer.id);

      // FALLBACK: Poll for notifications every 5 seconds as backup
      console.log('🔄 Setting up polling fallback (every 5s)...');
      const pollInterval = setInterval(() => {
        console.log('🔄 Polling for notification updates (fallback)...');
        loadManufacturerNotifications(manufacturer.id);
      }, 5000);

      // Return combined cleanup function
      return () => {
        console.log('🧹 Cleaning up subscription and polling...');
        subscriptionCleanup();
        clearInterval(pollInterval);
      };
    } catch (error) {
      console.error('Error loading manufacturer data:', error);
    }
  };

  const loadManufacturerNotifications = async (manufacturerId: string) => {
    try {
      console.log('Loading notifications for manufacturer ID:', manufacturerId);
      
      const { data: notifs, error } = await supabase
        .from('manufacturer_notifications')
        .select('*')
        .eq('manufacturer_id', manufacturerId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      console.log('Notifications query result:', notifs, 'Error:', error);

      if (error) {
        console.error('Error loading manufacturer notifications:', error);
        return;
      }

      // Count by type
      let samples = 0;
      let production = 0;
      let orders = 0;

      notifs?.forEach(notif => {
        if (notif.type === 'sample_requested') samples++;
        else if (notif.type === 'approved_for_production' || notif.type === 'route_to_production') production++;
        else if (notif.type === 'new_order' || notif.type === 'status_changed') orders++;
      });

      console.log('Notification counts - Total:', notifs?.length || 0, 'Samples:', samples, 'Production:', production, 'Orders:', orders);
      console.log('Updating notification state with unread count:', notifs?.length || 0);

      setNotifications(notifs || []);
      const newCounts = {
        orders,
        products: 0,
        total: notifs?.length || 0,
        samples,
        production
      };
      console.log('Setting notificationCounts to:', newCounts);
      setNotificationCounts(newCounts);
    } catch (error) {
      console.error('Error loading manufacturer notifications:', error);
    }
  };

  const subscribeToManufacturerNotifications = (manufacturerId: string) => {
    console.log('Setting up real-time subscription for manufacturer:', manufacturerId);

    const channel = supabase
      .channel(`manufacturer-notifications-${manufacturerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'manufacturer_notifications',
          filter: `manufacturer_id=eq.${manufacturerId}`,
        },
        (payload) => {
          console.log('✅ INSERT event - New manufacturer notification received:', payload);
          loadManufacturerNotifications(manufacturerId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'manufacturer_notifications',
          filter: `manufacturer_id=eq.${manufacturerId}`,
        },
        (payload) => {
          console.log('✅ UPDATE event - Manufacturer notification updated:', payload);
          console.log('Reloading notifications for manufacturer:', manufacturerId);
          loadManufacturerNotifications(manufacturerId);
        }
      )
      .subscribe((status, err) => {
        console.log('📡 Subscription status:', status);
        if (err) {
          console.error('❌ Subscription error:', err);
        }
      });

    return () => {
      console.log('🧹 Cleaning up subscription for manufacturer:', manufacturerId);
      supabase.removeChannel(channel);
    };
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setShowMobileMenu(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (showMobileMenu) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showMobileMenu]);

  const loadNotificationCounts = async (userId: string) => {
    try {
      const { data: notifs, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading notifications:', error);
        return;
      }

      let orderCount = 0;
      let productCount = 0;

      notifs?.forEach(notif => {
        if (notif.type === 'new_order' || notif.type === 'product_update') {
          orderCount++;
        }
        if (notif.type === 'approval_needed') {
          productCount++;
        }
      });

      setNotifications(notifs || []);
      setNotificationCounts({
        orders: orderCount,
        products: productCount,
        total: notifs?.length || 0
      });
    } catch (error) {
      console.error('Error loading notification counts:', error);
    }
  };

  const subscribeToNotifications = (userId: string) => {
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('New notification received:', payload);
          loadNotificationCounts(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async (notificationId: string) => {
    try {
      if (user?.role === 'manufacturer' && manufacturerId) {
        await supabase
          .from('manufacturer_notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('id', notificationId);
        
        loadManufacturerNotifications(manufacturerId);
      } else {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId);

        if (user?.id) {
          loadNotificationCounts(user.id);
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (user?.role === 'manufacturer' && manufacturerId) {
      try {
        await supabase
          .from('manufacturer_notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('manufacturer_id', manufacturerId)
          .eq('is_read', false);

        loadManufacturerNotifications(manufacturerId);
      } catch (error) {
        console.error('Error marking all as read:', error);
      }
    } else if (user?.id) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', user.id)
          .eq('is_read', false);

        loadNotificationCounts(user.id);
      } catch (error) {
        console.error('Error marking all as read:', error);
      }
    }
  };

  // Auto-mark notifications as read when viewing orders
  useEffect(() => {
    if (pathname?.includes('/orders')) {
      if (user?.role === 'manufacturer' && manufacturerId) {
        // Don't auto-mark as read for manufacturers - let them click
        console.log('Manufacturer viewing orders page');
      }
    }
  }, [pathname, user?.id, manufacturerId]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  const formatNotificationTime = (createdAt: string): string => {
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
  };

  // ADMIN/MANUFACTURER MENU
  const menuItems = [
    {
      type: 'section',
      label: 'OPERATIONS',
      roles: ['super_admin', 'admin', 'order_creator', 'order_approver', 'manufacturer', 'manufacturer_team_member', 'sub_manufacturer'],
    },
    {
      href: '/dashboard/orders',
      label: 'Orders',
      icon: ShoppingCart,
      roles: ['super_admin', 'admin', 'order_creator', 'order_approver', 'manufacturer', 'sub_manufacturer', 'manufacturer_team_member'],
      notificationKey: 'orders',
    },
    {
      href: '/dashboard/invoices',
      label: 'Invoices',
      icon: FileText,
      roles: ['super_admin', 'admin', 'order_approver'],
      notificationKey: 'invoices',
    },
    {
      type: 'section',
      label: 'PRODUCT CONFIG',
      roles: ['super_admin', 'admin'],
    },
    {
      href: '/dashboard/variants',
      label: 'Variants',
      icon: Layers,
      roles: ['super_admin', 'admin'],
      notificationKey: null,
    },
    {
      href: '/dashboard/products',
      label: 'Products',
      icon: Package,
      roles: ['super_admin', 'admin'],
      notificationKey: 'products',
    },
    {
      type: 'section',
      label: 'SYSTEM CONFIG',
      roles: ['super_admin', 'admin', 'manufacturer'],
    },
    {
      href: '/dashboard/settings/manufacturer',
      label: 'Settings',
      icon: Settings,
      roles: ['super_admin', 'manufacturer'],
      description: 'Manufacturer settings',
      notificationKey: null,
    },
    {
      href: '/dashboard/clients',
      label: 'Clients',
      icon: Users,
      roles: ['super_admin', 'admin'],
      description: 'Manage client emails',
      notificationKey: null,
    },
    {
      href: '/dashboard/manufacturers',
      label: 'Manufacturers',
      icon: Factory,
      roles: ['super_admin', 'admin'],
      description: 'Manage manufacturer emails',
      notificationKey: null,
    },
    {
      href: '/dashboard/users',
      label: 'Users',
      icon: UserCheck,
      roles: ['super_admin', 'manufacturer'],
      description: 'Manage system users',
      notificationKey: null,
    },
    {
      type: 'section',
      label: 'FINANCE',
      roles: ['super_admin'],
    },
    {
      href: '/dashboard/settings/finance',
      label: 'Finance Settings',
      icon: DollarSign,
      roles: ['super_admin'],
      description: 'Configure margins',
      notificationKey: null,
    }
  ];

  // CLIENT MENU - Simple navigation
  const clientMenuItems = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: LayoutGrid,
      roles: ['client'],
    },
    {
      href: '/dashboard/orders/client',
      label: 'Orders',
      icon: ShoppingCart,
      roles: ['client'],
      notificationKey: 'orders',
    },
    {
      href: '/dashboard/invoices',
      label: 'Invoices',
      icon: FileText,
      roles: ['client'],
    },
  ];

  // Use client menu if user is client, otherwise use regular menu
  const visibleMenuItems = user?.role === 'client' 
    ? clientMenuItems 
    : menuItems.filter(item => item.roles?.includes(user?.role || ''));

  const getInitial = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  const formatRole = (role: string) => {
    const roleDisplay: Record<string, string> = {
      'super_admin': 'Super Admin',
      'admin': 'Admin',
      'order_creator': 'Order Creator',
      'order_approver': 'Order Approver',
      'manufacturer': 'Manufacturer',
      'client': 'Client'
    };
    return roleDisplay[role] || role.replace('_', ' ');
  };

  const getPageTitle = () => {
    if (pathname === '/dashboard') return user?.role === 'client' ? 'My Dashboard' : 'Dashboard';
    if (pathname === '/dashboard/orders') return user?.role === 'manufacturer' ? 'Your Orders' : 'Orders Management';
    if (pathname === '/dashboard/orders/client') return 'My Orders';
    if (pathname.startsWith('/dashboard/orders/create')) return 'Create Order';
    if (pathname.startsWith('/dashboard/orders/edit')) return 'Edit Order';
    if (pathname === '/dashboard/invoices') return 'Invoices';
    if (pathname.startsWith('/dashboard/invoices/create')) return 'Create Invoice';
    if (pathname === '/dashboard/products') return 'Products';
    if (pathname === '/dashboard/variants') return 'Variants Configuration';
    if (pathname === '/dashboard/activity') return 'Activity Log';
    if (pathname === '/dashboard/clients') return 'Client Management';
    if (pathname === '/dashboard/manufacturers') return 'Manufacturer Management';
    if (pathname === '/dashboard/users') return 'User Management';
    if (pathname === '/dashboard/review') return 'Review Orders';
    if (pathname === '/dashboard/settings/finance') return 'Finance Settings';
    if (pathname === '/dashboard/settings/finance/orders') return 'Order Margins';
    if (pathname === '/dashboard/settings/manufacturer') return 'Manufacturer Settings';
    if (pathname.startsWith('/dashboard/orders/') && !pathname.includes('create') && !pathname.includes('edit') && !pathname.includes('client')) return 'Order Details';
    if (pathname.startsWith('/dashboard/invoices/') && !pathname.includes('create')) return 'Invoice Details';
    return 'Dashboard';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-72 lg:bg-white lg:border-r lg:border-gray-100 lg:flex lg:flex-col">
        <SidebarContent
          user={user}
          visibleMenuItems={visibleMenuItems}
          pathname={pathname}
          notificationCounts={notificationCounts}
          getInitial={getInitial}
          formatRole={formatRole}
          handleLogout={handleLogout}
        />
      </aside>

      {/* Mobile Sidebar */}
      <div className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ${showMobileMenu ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div 
          className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={() => setShowMobileMenu(false)}
        />
        <aside className={`absolute left-0 top-0 h-full w-full bg-white shadow-lg transform transition-transform duration-300 ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
          <SidebarContent
            user={user}
            visibleMenuItems={visibleMenuItems}
            pathname={pathname}
            notificationCounts={notificationCounts}
            getInitial={getInitial}
            formatRole={formatRole}
            handleLogout={handleLogout}
            onLinkClick={() => setShowMobileMenu(false)}
            onClose={() => setShowMobileMenu(false)}
          />
        </aside>
      </div>

      {/* Main Content */}
      <div className="lg:pl-72 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-4 lg:px-6 h-16">
            {/* Mobile Menu Button - left side */}
            <button
              onClick={() => setShowMobileMenu(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Open menu"
            >
              <Menu className="w-6 h-6 text-gray-700" />
            </button>
            
            {/* Page Title - centered on mobile, left on desktop */}
            <div className="flex-1 lg:flex-none text-center lg:text-left">
              <h1 className="text-base lg:text-lg font-medium text-gray-900 truncate px-2">
                {getPageTitle()}
              </h1>
            </div>

            {/* Notification Bell - right side */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {notificationCounts.total > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gradient-to-r from-blue-500 to-cyan-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold animate-pulse">
                    {notificationCounts.total > 9 ? '9+' : notificationCounts.total}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <>
                  {/* Click outside to close */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowNotifications(false)}
                  />
                  
                  <div className="fixed sm:absolute right-2 sm:right-0 mt-2 w-[calc(100vw-1rem)] sm:w-96 max-w-md bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                    <div className="p-3 sm:p-4 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="font-semibold text-sm sm:text-base text-gray-900">Notifications</h3>
                      <div className="flex items-center gap-1 sm:gap-2">
                        {notificationCounts.total > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-xs text-blue-600 hover:text-blue-700 whitespace-nowrap"
                          >
                            Mark all read
                          </button>
                        )}
                        <button
                          onClick={() => setShowNotifications(false)}
                          className="text-gray-400 hover:text-gray-600 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="max-h-[70vh] sm:max-h-96 overflow-y-auto">
                      {/* CLIENT specific notifications */}
                      {user?.role === 'client' && notificationCounts.orders > 0 && (
                        <div className="p-3 bg-amber-50 border-b border-amber-100">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-amber-800">
                                {notificationCounts.orders} order{notificationCounts.orders > 1 ? 's' : ''} need your approval
                              </p>
                              <Link 
                                href="/dashboard/orders/client"
                                className="text-xs text-amber-700 hover:text-amber-900 underline mt-1 inline-block"
                                onClick={() => setShowNotifications(false)}
                              >
                                View Orders →
                              </Link>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Manufacturer specific notifications */}
                      {user?.role === 'manufacturer' && notificationCounts.samples! > 0 && (
                        <div className="p-3 bg-yellow-50 border-b border-yellow-100">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-yellow-800">
                                {notificationCounts.samples} sample request{notificationCounts.samples! > 1 ? 's' : ''} need attention
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {user?.role === 'manufacturer' && notificationCounts.production! > 0 && (
                        <div className="p-3 bg-green-50 border-b border-green-100">
                          <div className="flex items-start gap-2">
                            <Package className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-green-800">
                                {notificationCounts.production} order{notificationCounts.production! > 1 ? 's' : ''} approved for production
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {notifications.length > 0 ? (
                        notifications.slice(0, 10).map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => !notif.is_read && markAsRead(notif.id)}
                            className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                              !notif.is_read ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs sm:text-sm ${!notif.is_read ? 'font-semibold' : ''} text-gray-900 break-words`}>
                                  {notif.message}
                                </p>
                              </div>
                              {!notif.is_read && (
                                <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1.5" />
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              {formatNotificationTime(notif.created_at)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 sm:p-8 text-center text-sm text-gray-500">
                          {user?.role === 'client' ? 'No orders need your attention' : 'No new notifications'}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}

// Sidebar Content Component
function SidebarContent({
  user,
  visibleMenuItems,
  pathname,
  notificationCounts,
  getInitial,
  formatRole,
  handleLogout,
  onLinkClick,
  onClose
}: {
  user: User | null;
  visibleMenuItems: any[];
  pathname: string;
  notificationCounts: NotificationCount;
  getInitial: (name: string) => string;
  formatRole: (role: string) => string;
  handleLogout: () => void;
  onLinkClick?: () => void;
  onClose?: () => void;
}) {
  // Debug log
  console.log('SidebarContent - User role:', user?.role, 'Notification counts:', notificationCounts);
  
  return (
    <div className="flex flex-col h-full">
      {/* Logo Section */}
      <div className="h-16 px-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">BirdHaus</h1>
          <p className="text-xs text-gray-500">Order Management</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        )}
      </div>

      {/* User Profile Section */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
            {getInitial(user?.name || '')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500">{formatRole(user?.role || '')}</p>
          </div>
        </div>
      </div>

      {/* CLIENT Notification Summary */}
      {user?.role === 'client' && notificationCounts.total > 0 && (
        <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              {notificationCounts.total} order{notificationCounts.total > 1 ? 's' : ''} need{notificationCounts.total === 1 ? 's' : ''} your approval
            </span>
          </div>
        </div>
      )}

      {/* Manufacturer Notification Summary */}
      {user?.role === 'manufacturer' && notificationCounts.total > 0 && (
        <div className="mx-4 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">
              You have {notificationCounts.total} new notification{notificationCounts.total > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-1 text-xs text-yellow-700">
            {notificationCounts.samples! > 0 && (
              <div>• {notificationCounts.samples} sample request{notificationCounts.samples! > 1 ? 's' : ''}</div>
            )}
            {notificationCounts.production! > 0 && (
              <div>• {notificationCounts.production} approved for production</div>
            )}
            {notificationCounts.orders > 0 && (
              <div>• {notificationCounts.orders} order update{notificationCounts.orders > 1 ? 's' : ''}</div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {visibleMenuItems.map((item, index) => {
          if (item.type === 'section') {
            return (
              <div key={`section-${index}`} className="px-6 py-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {item.label}
                </p>
              </div>
            );
          }

          const Icon = item.icon!;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
          
          // Notification badge logic
          let notificationCount = 0;
          if (user?.role === 'client' && item.href === '/dashboard/orders/client') {
            notificationCount = notificationCounts.total;
          } else if (user?.role === 'manufacturer' && item.href === '/dashboard/orders') {
            notificationCount = notificationCounts.total;
          } else if (item.notificationKey) {
            notificationCount = notificationCounts[item.notificationKey as keyof NotificationCount] || 0;
          }
          
          return (
            <div key={item.href} className="mb-1">
              <Link
                href={item.href!}
                onClick={onLinkClick}
                className={`flex items-center justify-between px-6 pl-10 py-2.5 text-sm transition-colors relative ${
                  isActive
                    ? 'text-blue-600 bg-blue-50 border-r-2 border-blue-600'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className="font-medium truncate">{item.label}</span>
                </div>
                
                {notificationCount > 0 && (
                  <span className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white text-xs rounded-full px-2 py-0.5 font-semibold flex-shrink-0 ml-2 animate-pulse">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </Link>
              
              {item.description && (
                <p className="px-6 pl-14 py-1 text-xs text-gray-500">
                  {item.description}
                </p>
              )}
            </div>
          );
        })}
      </nav>

      {/* Logout Section */}
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={() => {
            handleLogout();
            onLinkClick?.();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white font-semibold">{getInitial(user?.name || '')}</span>
          </div>
          <span className="flex-1 text-left font-medium truncate">Logout</span>
        </button>
      </div>
    </div>
  );
}