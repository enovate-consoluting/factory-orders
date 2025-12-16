/**
 * AccessoriesSection - Wrapper component for AccessoriesCard
 * Only renders when accessories exist and user has permission
 * Last Modified: December 2025
 */

'use client';

import React from 'react';
import { Tag } from 'lucide-react';
import { AccessoriesCard } from './AccessoriesCard';

interface AccessoriesSectionProps {
  orderId: string;
  userRole: string;
  onUpdate?: () => void;
  isVisible: boolean;
}

export function AccessoriesSection({ orderId, userRole, onUpdate, isVisible }: AccessoriesSectionProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
        <Tag className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
        Accessories
      </h2>
      <AccessoriesCard
        orderId={orderId}
        userRole={userRole}
        onUpdate={onUpdate}
      />
    </div>
  );
}

