'use client';

import { useEffect, useState, useCallback } from 'react';
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
  Menu
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
    total: 0 
  });
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }
    
    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      // Load notifications for this user
      if (parsedUser.id) {
        loadNotificationCounts(parsedUser.id);
        subscribeToNotifications(parsedUser.id);
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Load notification counts
  const loadNotificationCounts = async (userId: string) => {
    try {
      // Get all unread notifications for this user
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

      // Count notifications by type
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

  // Subscribe to real-time notifications
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
          // Reload notification counts when new notification arrives
          loadNotificationCounts(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      // Reload counts
      if (user?.id) {
        loadNotificationCounts(user.id);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      // Reload counts
      loadNotificationCounts(user.id);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // When pathname changes, check if we should clear notifications
  useEffect(() => {
    if (user?.id && pathname) {
      // If user visits orders page, mark order notifications as read
      if (pathname.includes('/orders')) {
        markOrderNotificationsAsRead();
      }
    }
  }, [pathname, user?.id]);

  const markOrderNotificationsAsRead = async () => {
    if (!user?.id) return;
    
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .in('type', ['new_order', 'product_update'])
        .eq('is_read', false);

      // Reload counts
      loadNotificationCounts(user.id);
    } catch (error) {
      console.error('Error marking order notifications as read:', error);
    }
  };

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

  const menuItems = [
    {
      type: 'section',
      label: 'MAIN MENU',
      roles: ['super_admin', 'admin', 'order_creator', 'order_approver', 'manufacturer', 'client'],
    },
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: LayoutGrid,
      roles: ['super_admin', 'admin', 'order_creator', 'order_approver', 'manufacturer', 'client'],
      notificationKey: null,
    },
    {
      href: '/dashboard/orders',
      label: 'Orders',
      icon: ShoppingCart,
      roles: ['super_admin', 'admin', 'order_creator', 'order_approver', 'manufacturer'],
      notificationKey: 'orders',
    },
    {
      href: '/dashboard/products',
      label: 'Products',
      icon: Package,
      roles: ['super_admin', 'admin'],
      notificationKey: 'products',
    },
    {
      href: '/dashboard/variants',
      label: 'Variants',
      icon: Layers,
      roles: ['super_admin', 'admin'],
      notificationKey: null,
    },
    {
      href: '/dashboard/activity',
      label: 'Activity',
      icon: Activity,
      roles: ['super_admin', 'admin'],
      notificationKey: null,
    },
    {
      type: 'section',
      label: 'CONFIGURATION',
      roles: ['super_admin', 'admin', 'client'],
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
      roles: ['super_admin'],
      description: 'Manage system users',
      notificationKey: null,
    },
    {
      href: '/dashboard/review',
      label: 'Review Orders',
      icon: ShoppingCart,
      roles: ['client'],
      notificationKey: null,
    },
  ];

  const visibleMenuItems = menuItems.filter(item =>
    item.roles?.includes(user?.role || '')
  );

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setShowMobileMenu(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white rounded-lg shadow-lg"
      >
        <Menu className="w-6 h-6 text-gray-700" />
      </button>

      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex w-72 bg-white h-screen flex-col border-r border-gray-100`}>
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

      {/* Sidebar - Mobile Overlay */}
      {showMobileMenu && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setShowMobileMenu(false)}
          />
          <aside className="relative w-72 bg-white h-full flex flex-col border-r border-gray-100">
            <button
              onClick={() => setShowMobileMenu(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent
              user={user}
              visibleMenuItems={visibleMenuItems}
              pathname={pathname}
              notificationCounts={notificationCounts}
              getInitial={getInitial}
              formatRole={formatRole}
              handleLogout={handleLogout}
              onLinkClick={() => setShowMobileMenu(false)}
            />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="bg-white h-16 border-b border-gray-100 flex items-center justify-between px-6 pl-16 lg:pl-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {pathname === '/dashboard' && 'Dashboard'}
            {pathname === '/dashboard/orders' && 'Orders Management'}
            {pathname.startsWith('/dashboard/orders/create') && 'Create Order'}
            {pathname.startsWith('/dashboard/orders/edit') && 'Edit Order'}
            {pathname === '/dashboard/products' && 'Products'}
            {pathname === '/dashboard/variants' && 'Variants Configuration'}
            {pathname === '/dashboard/activity' && 'Activity Log'}
            {pathname === '/dashboard/clients' && 'Client Management'}
            {pathname === '/dashboard/manufacturers' && 'Manufacturer Management'}
            {pathname === '/dashboard/users' && 'User Management'}
            {pathname === '/dashboard/review' && 'Review Orders'}
            {(pathname.startsWith('/dashboard/orders/') && !pathname.includes('create') && !pathname.includes('edit')) && 'Order Details'}
          </h2>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {notificationCounts.total > 0 && (
                <span className="absolute -top-1 -right-1 bg-gradient-to-r from-blue-500 to-cyan-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                  {notificationCounts.total > 9 ? '9+' : notificationCounts.total}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Notifications</h3>
                  <div className="flex items-center gap-2">
                    {notificationCounts.total > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Mark all as read
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.slice(0, 10).map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => !notif.is_read && markAsRead(notif.id)}
                        className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                          !notif.is_read ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className={`text-sm ${!notif.is_read ? 'font-semibold' : ''} text-gray-900`}>
                              {notif.message}
                            </p>
                          </div>
                          {!notif.is_read && (
                            <span className="w-2 h-2 bg-blue-600 rounded-full ml-2 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatNotificationTime(notif.created_at)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      No notifications
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-6 bg-gray-50 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

// Sidebar Content Component (shared between desktop and mobile)
function SidebarContent({
  user,
  visibleMenuItems,
  pathname,
  notificationCounts,
  getInitial,
  formatRole,
  handleLogout,
  onLinkClick
}: {
  user: User | null;
  visibleMenuItems: any[];
  pathname: string;
  notificationCounts: NotificationCount;
  getInitial: (name: string) => string;
  formatRole: (role: string) => string;
  handleLogout: () => void;
  onLinkClick?: () => void;
}) {
  return (
    <>
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">BirdHaus</h1>
        <p className="text-sm text-gray-500 mt-1">Order Management</p>
      </div>

      {/* User Profile Section */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
            {getInitial(user?.name || '')}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500">{formatRole(user?.role || '')}</p>
          </div>
        </div>
      </div>

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
          const notificationCount = item.notificationKey ? notificationCounts[item.notificationKey as keyof NotificationCount] : 0;
          
          return (
            <div key={item.href} className="mb-1">
              <Link
                href={item.href!}
                onClick={onLinkClick}
                className={`flex items-center justify-between px-6 py-2.5 text-sm transition-colors relative ${
                  isActive
                    ? 'text-blue-600 bg-blue-50 border-r-2 border-blue-600'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className="font-medium">{item.label}</span>
                </div>
                
                {/* Notification Badge */}
                {notificationCount > 0 && (
                  <span className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white text-xs rounded-full px-2 py-0.5 font-semibold">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </Link>
              
              {/* Description text underneath */}
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
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold">{getInitial(user?.name || '')}</span>
          </div>
          <span className="flex-1 text-left font-medium">Logout</span>
        </button>
      </div>
    </>
  );
}