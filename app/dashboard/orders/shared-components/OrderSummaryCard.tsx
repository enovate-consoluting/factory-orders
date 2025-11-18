/**
 * Order Summary Card Component
 * Displays order name with client and manufacturer info
 * Used at the top of order creation step 3
 * Last Modified: November 2025
 */

import React from 'react';

interface Client {
  id: string;
  name: string;
  email: string;
}

interface Manufacturer {
  id: string;
  name: string;
  email: string;
}

interface OrderSummaryCardProps {
  orderName: string;
  client?: Client;
  manufacturer?: Manufacturer;
}

export const OrderSummaryCard: React.FC<OrderSummaryCardProps> = ({
  orderName,
  client,
  manufacturer
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <div className="border-b border-gray-200 pb-3 mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{orderName}</h3>
        <p className="text-sm text-gray-500 mt-1">Order details and configuration</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Client</p>
            <p className="font-semibold text-gray-900">{client?.name || 'N/A'}</p>
            <p className="text-sm text-gray-600">{client?.email || 'N/A'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Manufacturer</p>
            <p className="font-semibold text-gray-900">{manufacturer?.name || 'N/A'}</p>
            <p className="text-sm text-gray-600">{manufacturer?.email || 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};