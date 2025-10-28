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
  Mail
} from 'lucide-react';
import { useNotifications, getNotificationMessage, getNotificationIcon, formatNotificationTime } from '@/app/hooks/useNotifications';
import { UINotification } from '@/app/components/UINotification';
import { useUINotification } from '@/app/hooks/useUINotification';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
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
  
  // Database notifications (existing)
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(user?.id || null);
  
  // UI notifications (new - for success/error messages)
  const { notification: uiNotification, hideNotification } = useUINotification();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }
    
    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  const handleNotificationClick = async (notificationId: string, orderId?: string, orderProductId?: string) => {
    await markAsRead(notificationId);
    if (orderId) {
      router.push(`/dashboard/orders/${orderId}`);
      setShowNotifications(false);
    }
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
    },
    {
      href: '/dashboard/orders',
      label: 'Orders',
      icon: ShoppingCart,
      roles: ['super_admin', 'admin', 'order_creator', 'order_approver', 'manufacturer'],
      badge: user?.role !== 'client' && unreadCount > 0 ? unreadCount : 0,
    },
    {
      href: '/dashboard/products',
      label: 'Products',
      icon: Package,
      roles: ['super_admin', 'admin'],
    },
    {
      href: '/dashboard/variants',
      label: 'Variants',
      icon: Layers,
      roles: ['super_admin', 'admin'],
    },
    {
      href: '/dashboard/activity',
      label: 'Activity',
      icon: Activity,
      roles: ['super_admin', 'admin'],
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
      description: 'Manage client emails'
    },
    {
      href: '/dashboard/manufacturers',
      label: 'Manufacturers',
      icon: Factory,
      roles: ['super_admin', 'admin'],
      description: 'Manage manufacturer emails'
    },
    {
      href: '/dashboard/users',
      label: 'Users',
      icon: UserCheck,
      roles: ['super_admin'],
      description: 'Manage system users'
    },
    {
      href: '/dashboard/review',
      label: 'Review Orders',
      icon: ShoppingCart,
      roles: ['client'],
      badge: user?.role === 'client' && unreadCount > 0 ? unreadCount : 0,
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
      {/* Sidebar */}
      <aside className="w-72 bg-white h-screen flex flex-col border-r border-gray-100">
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
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            
            return (
              <div key={item.href} className="mb-1">
                <Link
                  href={item.href!}
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
                  {item.badge && item.badge > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
                
                {/* Description text underneath (no dropdown) */}
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
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="bg-white h-16 border-b border-gray-100 flex items-center justify-between px-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {pathname === '/dashboard' && 'Dashboard'}
            {pathname === '/dashboard/orders' && 'Orders Management'}
            {pathname === '/dashboard/products' && 'Products'}
            {pathname === '/dashboard/variants' && 'Variants Configuration'}
            {pathname === '/dashboard/activity' && 'Activity Log'}
            {pathname === '/dashboard/clients' && 'Client Management'}
            {pathname === '/dashboard/manufacturers' && 'Manufacturer Management'}
            {pathname === '/dashboard/users' && 'User Management'}
            {pathname === '/dashboard/review' && 'Review Orders'}
            {pathname.startsWith('/dashboard/orders/') && 'Order Details'}
          </h2>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Notifications</h3>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
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
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No notifications
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {notifications.slice(0, 10).map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationClick(
                            notification.id,
                            notification.order_id,
                            notification.order_product_id
                          )}
                          className={`p-4 hover:bg-gray-50 cursor-pointer ${
                            !notification.is_read ? 'bg-blue-50/30' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-xl">{getNotificationIcon(notification.type)}</span>
                            <div className="flex-1">
                              <p className="text-sm text-gray-900">
                                {getNotificationMessage(notification)}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {formatNotificationTime(notification.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
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

      {/* UI Notification Component - Shows success/error messages */}
      {uiNotification && (
        <UINotification
          message={uiNotification.message}
          type={uiNotification.type}
          onClose={hideNotification}
        />
      )}
    </div>
  );
}