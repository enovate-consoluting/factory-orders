// app/dashboard/orders/[id]/hooks/usePermissions.ts

import { useEffect, useState } from 'react';
import { OrderPermissions, UserRole } from '../types/order.types';

export function usePermissions() {
  const [permissions, setPermissions] = useState<OrderPermissions>({
    canViewCosts: false,
    canEditCosts: false,
    canViewClientPricing: false,
    canEditClientPricing: false,
    canApprove: false,
    canViewInternalNotes: false,
    canEditInternalNotes: false,
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) return;

    const user = JSON.parse(userData);
    const role = user.role as UserRole;

    const perms: OrderPermissions = {
      // Only super_admin can see/edit actual costs
      canViewCosts: role === 'super_admin',
      canEditCosts: role === 'super_admin',
      
      // Super admin and admin can see client pricing
      canViewClientPricing: ['super_admin', 'admin', 'order_approver'].includes(role),
      canEditClientPricing: ['super_admin', 'order_approver'].includes(role),
      
      // Approval permissions
      canApprove: ['super_admin', 'admin', 'order_approver'].includes(role),
      
      // Internal notes - not visible to manufacturers or clients
      canViewInternalNotes: ['super_admin', 'admin', 'order_creator', 'order_approver'].includes(role),
      canEditInternalNotes: ['super_admin', 'admin', 'order_approver'].includes(role),
    };

    setPermissions(perms);
  }, []);

  return permissions;
}

export function getUserRole(): UserRole | null {
  const userData = localStorage.getItem('user');
  if (!userData) return null;
  
  const user = JSON.parse(userData);
  return user.role as UserRole;
}