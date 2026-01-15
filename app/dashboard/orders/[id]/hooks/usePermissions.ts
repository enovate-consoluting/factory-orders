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
      // Only super_admin/system_admin can see/edit actual costs
      canViewCosts: role === 'super_admin' || role === 'system_admin',
      canEditCosts: role === 'super_admin' || role === 'system_admin',
      
      // Super admin, system admin and admin can see client pricing
      canViewClientPricing: ['super_admin', 'system_admin', 'admin', 'order_approver'].includes(role),
      canEditClientPricing: ['super_admin', 'system_admin', 'order_approver'].includes(role),

      // Approval permissions
      canApprove: ['super_admin', 'system_admin', 'admin', 'order_approver'].includes(role),

      // Internal notes - not visible to manufacturers or clients
      canViewInternalNotes: ['super_admin', 'system_admin', 'admin', 'order_creator', 'order_approver'].includes(role),
      canEditInternalNotes: ['super_admin', 'system_admin', 'admin', 'order_approver'].includes(role),
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