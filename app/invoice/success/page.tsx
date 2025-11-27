'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Home, FileText } from 'lucide-react';
import Link from 'next/link';

export default function InvoiceSuccessPage() {
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  
  useEffect(() => {
    // Get params from URL on client side only
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setCheckoutId(params.get('checkoutId'));
      setTransactionId(params.get('transactionId'));
    }
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
        <p className="text-gray-600 mb-6">
          Thank you for your payment. Your invoice has been paid successfully.
        </p>
        
        {transactionId && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500">Transaction ID:</p>
            <p className="text-sm font-mono text-gray-700">{transactionId}</p>
          </div>
        )}
        
        <div className="space-y-3">
          <Link 
            href="/dashboard/invoices"
            className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FileText className="w-5 h-5" />
            View Invoices
          </Link>
          
          <Link 
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <Home className="w-5 h-5" />
            Return to Home
          </Link>
        </div>
        
        <p className="text-xs text-gray-500 mt-6">
          A receipt has been sent to your email address.
        </p>
      </div>
    </div>
  );
}