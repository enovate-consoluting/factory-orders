'use client';

/**
 * Reports Page - /dashboard/reports
 * Central hub for business reports and analytics
 * Roles: Super Admin only
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  FileText,
  Calendar,
  ArrowRight,
  Clock
} from 'lucide-react';

interface ReportCard {
  id: string;
  title: string;
  description: string;
  icon: any;
  href: string;
  color: string;
  available: boolean;
}

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'super_admin') {
      router.push('/dashboard');
      return;
    }
    setUser(parsedUser);
  }, [router]);

  const reports: ReportCard[] = [
    {
      id: 'sales-summary',
      title: 'Sales Summary',
      description: 'Revenue, orders, and payment trends over time',
      icon: DollarSign,
      href: '/dashboard/reports/sales',
      color: 'green',
      available: true,
    },
    {
      id: 'order-analytics',
      title: 'Order Analytics',
      description: 'Order volume, status breakdown, and processing times',
      icon: Package,
      href: '/dashboard/reports/orders',
      color: 'blue',
      available: false,
    },
    {
      id: 'client-insights',
      title: 'Client Insights',
      description: 'Top clients, order frequency, and revenue by client',
      icon: Users,
      href: '/dashboard/reports/clients',
      color: 'purple',
      available: false,
    },
    {
      id: 'product-performance',
      title: 'Product Performance',
      description: 'Best sellers, product trends, and category analysis',
      icon: TrendingUp,
      href: '/dashboard/reports/products',
      color: 'orange',
      available: true,
    },
    {
      id: 'invoice-aging',
      title: 'Invoice Aging',
      description: 'Outstanding invoices, payment delays, and collection status',
      icon: FileText,
      href: '/dashboard/reports/invoices',
      color: 'red',
      available: false,
    },
    {
      id: 'audit-log',
      title: 'Audit Log',
      description: 'System activity, user actions, and change history',
      icon: Clock,
      href: '/dashboard/reports/audit',
      color: 'gray',
      available: true,
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
      blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
      purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
      orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
      red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
      gray: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
    };
    return colors[color] || colors.gray;
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Reports</h1>
              <p className="text-sm text-gray-500">Business analytics and insights</p>
            </div>
          </div>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => {
            const colors = getColorClasses(report.color);
            const Icon = report.icon;

            return report.available ? (
              <Link
                key={report.id}
                href={report.href}
                className={`bg-white rounded-xl border ${colors.border} p-5 hover:shadow-lg transition-all group`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{report.title}</h3>
                <p className="text-sm text-gray-500">{report.description}</p>
              </Link>
            ) : (
              <div
                key={report.id}
                className="bg-white rounded-xl border border-gray-200 p-5 opacity-60"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                    Coming Soon
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{report.title}</h3>
                <p className="text-sm text-gray-500">{report.description}</p>
              </div>
            );
          })}
        </div>

        {/* Help Text */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Need a custom report?</h4>
              <p className="text-sm text-blue-700 mt-1">
                Contact support to request specific reports or data exports for your business needs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
