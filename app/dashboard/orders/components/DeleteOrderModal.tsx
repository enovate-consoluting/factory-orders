/**
 * Delete Order Modal Component
 * Confirmation modal for deleting orders
 * Location: app/dashboard/orders/components/DeleteOrderModal.tsx
 * Last Modified: Nov 26 2025
 */

import React from 'react';
import { Shield } from 'lucide-react';
import { Translations } from '../utils/orderListTranslations';
import { TFunction } from 'i18next';
interface DeleteOrderModalProps {
  isOpen: boolean;
  orderNumber: string;
  userRole: string | null;
  isDeleting: boolean;
  t: TFunction;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteOrderModal: React.FC<DeleteOrderModalProps> = ({
  isOpen,
  orderNumber,
  userRole,
  isDeleting,
  t,
  onConfirm,
  onCancel
}) => {
  // Prevent background scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('confirmDelete')}
          </h3>
          
          {userRole === 'super_admin' && (
            <div className="flex items-center gap-2 mb-3 text-amber-600">
              <Shield className="w-4 h-4" />
              <span className="text-sm">{t('superAdminOverride')}</span>
            </div>
          )}
          
          <p className="text-gray-600">
            {t('areYouSure')  }{' '}
            <strong>{orderNumber}</strong>?
          </p>
          
          <p className="text-red-600 text-sm mt-2">
            {t('permanentDelete')}
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-black"
            disabled={isDeleting}
          >
            {t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            disabled={isDeleting}
          >
            {isDeleting ? t('deleting') : t('deleteOrder')}
          </button>
        </div>
      </div>
    </div>
  );
};