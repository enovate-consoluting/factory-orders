'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Settings, 
  LogOut,
  Layers,
  Users,
  Factory,
  UserCircle,
  Mail,
  Menu,
  X,
  Activity
} from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/');
    } else {
      setUser(JSON.parse(storedUser));
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  const navigation = [
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: LayoutDashboard,
      roles: ['super_admin', 'admin', 'user', 'order_creator', 'order_approver', 'manufacturer'] 
    },
    { 
      name: 'Orders', 
      href: '/dashboard/orders', 
      icon: ShoppingCart,
      roles: ['super_admin', 'admin', 'user', 'order_creator', 'order_approver', 'manufacturer'] 
    },
    { 
      name: 'Products', 
      href: '/dashboard/products', 
      icon: Package,
      roles: ['super_admin'] 
    },
    { 
      name: 'Variants', 
      href: '/dashboard/variants', 
      icon: Layers,
      roles: ['super_admin'] 
    },
    { 
      name: 'Activity', 
      href: '/dashboard/activity', 
      icon: Activity,
      roles: ['super_admin', 'admin'] 
    },
  ];

  const configNavigation = [
    { 
      name: 'Clients', 
      href: '/dashboard/clients', 
      icon: Users,
      roles: ['super_admin', 'admin', 'order_approver'],
      description: 'Manage client emails'
    },
    { 
      name: 'Manufacturers', 
      href: '/dashboard/manufacturers', 
      icon: Factory,
      roles: ['super_admin', 'admin', 'order_approver'],
      description: 'Manage manufacturer emails'
    },
    { 
      name: 'Users', 
      href: '/dashboard/users', 
      icon: UserCircle,
      roles: ['super_admin', 'admin'],
      description: 'Manage system users'
    },
  ];

  const isActiveRoute = (href: string) => pathname === href;

  const handleNavigate = (href: string) => {
    router.push(href);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="py-1 px-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center w-full">
                {/* Logo - Pull up 3 more units */}
                <img
                  src="/logo.png"
                  alt="Birdhaus Logo"
                  className="w-48 h-48 object-contain -mt-13"
                />
                {/* Text position */}
                <div className="text-center -mt-16">
                  <p className="text-xs sm:text-sm font-medium text-gray-700">Order Management</p>
                </div>
              </div>
              {/* Mobile Close Button */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden absolute top-2 right-2 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* User Info */}
          {user && (
            <div className="p-3 sm:p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-sm sm:text-base">
                    {user.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 text-sm font-medium truncate">{user.name}</p>
                  <p className="text-gray-500 text-xs capitalize truncate">
                    {user.role?.replace('_', ' ')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main Navigation */}
          <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto">
            <div className="mb-4 sm:mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 sm:mb-3 px-3">
                Main Menu
              </h3>
              {navigation.map((item) => {
                if (user && !item.roles.includes(user.role)) return null;
                
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNavigate(item.href)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActiveRoute(item.href)
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    {item.name}
                  </button>
                );
              })}
            </div>

            {/* Configuration Section */}
            {user && (user.role === 'super_admin' || user.role === 'admin' || user.role === 'order_approver') && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 sm:mb-3 px-3 flex items-center gap-2">
                  <Settings className="w-3 h-3" />
                  Configuration
                </h3>
                {configNavigation.map((item) => {
                  if (!item.roles.includes(user.role)) return null;
                  
                  return (
                    <button
                      key={item.name}
                      onClick={() => handleNavigate(item.href)}
                      className={`w-full group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActiveRoute(item.href)
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <item.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          {item.name}
                          {(item.href === '/dashboard/clients' || item.href === '/dashboard/manufacturers') && (
                            <Mail className="w-3 h-3 opacity-60" />
                          )}
                        </div>
                        {!isActiveRoute(item.href) && (
                          <p className="text-xs text-gray-500 group-hover:text-gray-600 mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </nav>

          {/* Logout */}
          <div className="p-3 sm:p-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all w-full"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
                >
                  <Menu className="w-5 h-5 text-gray-600" />
                </button>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
                  {pathname === '/dashboard' && 'Dashboard'}
                  {pathname === '/dashboard/orders' && 'Orders Management'}
                  {pathname?.startsWith('/dashboard/orders/create') && 'Create New Order'}
                  {pathname?.startsWith('/dashboard/orders/edit') && 'Edit Draft Order'}
                  {pathname === '/dashboard/products' && 'Products Management'}
                  {pathname === '/dashboard/variants' && 'Variants Configuration'}
                  {pathname === '/dashboard/clients' && 'Client Configuration'}
                  {pathname === '/dashboard/manufacturers' && 'Manufacturer Configuration'}
                  {pathname === '/dashboard/users' && 'Users Management'}
                  {pathname === '/dashboard/activity' && 'Activity Dashboard'}
                  {pathname?.match(/\/dashboard\/orders\/[^\/]+$/) && 'Order Details'}
                </h2>
              </div>
              <div className="hidden sm:block text-sm text-gray-500">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}