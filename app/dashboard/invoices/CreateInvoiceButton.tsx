/**
 * CreateInvoiceButton - Button with invoice gate check
 * Checks for existing invoices before navigating to create invoice page
 * Shows ExistingInvoicesModal if invoices already exist
 * 
 * Usage: Replace your current "Create Invoice" button with this component
 * 
 * Last Modified: December 1, 2025
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2 } from 'lucide-react';
import { useInvoiceCheck } from './useInvoiceCheck';
import ExistingInvoicesModal from './ExistingInvoicesModal';

interface CreateInvoiceButtonProps {
  orderId: string;
  orderNumber: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export default function CreateInvoiceButton({
  orderId,
  orderNumber,
  className = '',
  variant = 'primary',
  size = 'md'
}: CreateInvoiceButtonProps) {
  const router = useRouter();
  const { loading, checkResult, checkExistingInvoices, clearCheck } = useInvoiceCheck();
  const [showModal, setShowModal] = useState(false);

  const handleClick = async () => {
    // Check for existing invoices
    const result = await checkExistingInvoices(orderId);
    
    if (result.hasExistingInvoices) {
      // Show the gate modal
      setShowModal(true);
    } else {
      // No existing invoices, proceed directly
      router.push(`/dashboard/invoices/create?order=${orderId}`);
    }
  };

  const handleClose = () => {
    setShowModal(false);
    clearCheck();
  };

  const handleProceedWithRemaining = () => {
    // Close modal and navigate to create invoice
    // The create invoice page will only show uninvoiced products
    setShowModal(false);
    router.push(`/dashboard/invoices/create?order=${orderId}&uninvoiced_only=true`);
  };

  const handleRefresh = async () => {
    // Re-check invoices after voiding
    await checkExistingInvoices(orderId);
  };

  // Button styles based on variant and size
  const baseStyles = 'font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50';
  
  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50'
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base'
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking...
          </>
        ) : (
          <>
            <FileText className="w-4 h-4" />
            Create Invoice
          </>
        )}
      </button>

      {showModal && checkResult && (
        <ExistingInvoicesModal
          isOpen={showModal}
          onClose={handleClose}
          orderId={orderId}
          orderNumber={orderNumber}
          existingInvoices={checkResult.existingInvoices}
          uninvoicedProductCount={checkResult.uninvoicedProductCount}
          totalProductCount={checkResult.totalProductCount}
          onProceedWithRemaining={handleProceedWithRemaining}
          onRefresh={handleRefresh}
        />
      )}
    </>
  );
}
