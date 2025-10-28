// Role-based permissions configuration
// This file centralizes all permission settings for easy management

export interface RolePermissions {
  // Order Management
  canCreateOrders: boolean;
  canEditOrders: boolean;
  canDeleteOrders: boolean;
  canViewAllOrders: boolean;
  
  // Product Routing
  canRouteProducts: boolean;
  canLockProducts: boolean;
  
  // Pricing
  canEditPricing: boolean;
  canViewPricing: boolean;
  
  // Media & Notes
  canUploadMedia: boolean;
  canAddNotes: boolean;
  canDeleteMedia: boolean;
  
  // Approvals
  canApproveItems: boolean;
  canRejectItems: boolean;
  
  // Status Updates
  canUpdateOrderStatus: boolean;
  canUpdateProductStatus: boolean;
  canSendToManufacturer: boolean;
  canSendToClient: boolean;
  
  // Communication
  canCommunicateWithClient: boolean;
  canCommunicateWithManufacturer: boolean;
  
  // Admin Features
  canManageProducts: boolean;
  canManageVariants: boolean;
  canManageUsers: boolean;
  canViewAuditLog: boolean;
}

export const ROLE_PERMISSIONS: Record<string, RolePermissions> = {
  super_admin: {
    // Full access to everything
    canCreateOrders: true,
    canEditOrders: true,
    canDeleteOrders: true,
    canViewAllOrders: true,
    canRouteProducts: true,
    canLockProducts: true,
    canEditPricing: false, // Usually manufacturers handle pricing
    canViewPricing: true,
    canUploadMedia: true,
    canAddNotes: true,
    canDeleteMedia: true,
    canApproveItems: true,
    canRejectItems: true,
    canUpdateOrderStatus: true,
    canUpdateProductStatus: true,
    canSendToManufacturer: true,
    canSendToClient: true,
    canCommunicateWithClient: true,
    canCommunicateWithManufacturer: true,
    canManageProducts: true,
    canManageVariants: true,
    canManageUsers: true,
    canViewAuditLog: true,
  },
  
  admin: {
    // Almost full access, some restrictions
    canCreateOrders: true,
    canEditOrders: true,
    canDeleteOrders: true,
    canViewAllOrders: true,
    canRouteProducts: true,
    canLockProducts: true,
    canEditPricing: false,
    canViewPricing: true,
    canUploadMedia: true,
    canAddNotes: true,
    canDeleteMedia: true,
    canApproveItems: true,
    canRejectItems: true,
    canUpdateOrderStatus: true,
    canUpdateProductStatus: true,
    canSendToManufacturer: true,
    canSendToClient: true,
    canCommunicateWithClient: true,
    canCommunicateWithManufacturer: true,
    canManageProducts: false, // Only super_admin
    canManageVariants: false, // Only super_admin
    canManageUsers: false, // Only super_admin
    canViewAuditLog: true,
  },
  
  order_approver: {
    // Can approve and route orders
    canCreateOrders: true,
    canEditOrders: true,
    canDeleteOrders: false,
    canViewAllOrders: true,
    canRouteProducts: true,
    canLockProducts: false,
    canEditPricing: false,
    canViewPricing: true,
    canUploadMedia: true,
    canAddNotes: true,
    canDeleteMedia: false,
    canApproveItems: true,
    canRejectItems: true,
    canUpdateOrderStatus: true,
    canUpdateProductStatus: true,
    canSendToManufacturer: true,
    canSendToClient: true,
    canCommunicateWithClient: true,
    canCommunicateWithManufacturer: true,
    canManageProducts: false,
    canManageVariants: false,
    canManageUsers: false,
    canViewAuditLog: true,
  },
  
  order_creator: {
    // Can create and edit own orders
    canCreateOrders: true,
    canEditOrders: true, // Own orders only
    canDeleteOrders: false,
    canViewAllOrders: false, // Own orders only
    canRouteProducts: false,
    canLockProducts: false,
    canEditPricing: false,
    canViewPricing: true,
    canUploadMedia: true,
    canAddNotes: true,
    canDeleteMedia: false,
    canApproveItems: false,
    canRejectItems: false,
    canUpdateOrderStatus: false,
    canUpdateProductStatus: false,
    canSendToManufacturer: false,
    canSendToClient: false,
    canCommunicateWithClient: false,
    canCommunicateWithManufacturer: false,
    canManageProducts: false,
    canManageVariants: false,
    canManageUsers: false,
    canViewAuditLog: true,
  },
  
  manufacturer: {
    // Manufacturing partner permissions
    canCreateOrders: false,
    canEditOrders: false,
    canDeleteOrders: false,
    canViewAllOrders: false, // Only assigned orders
    canRouteProducts: false,
    canLockProducts: false,
    canEditPricing: true, // Primary function
    canViewPricing: true,
    canUploadMedia: true, // For samples
    canAddNotes: true,
    canDeleteMedia: false,
    canApproveItems: false,
    canRejectItems: true, // Can reject if not feasible
    canUpdateOrderStatus: false,
    canUpdateProductStatus: true, // Can update production status
    canSendToManufacturer: false,
    canSendToClient: false,
    canCommunicateWithClient: false, // No direct client contact
    canCommunicateWithManufacturer: false,
    canManageProducts: false,
    canManageVariants: false,
    canManageUsers: false,
    canViewAuditLog: true, // Their actions only
  },
  
  client: {
    // Client/customer permissions
    canCreateOrders: false,
    canEditOrders: false,
    canDeleteOrders: false,
    canViewAllOrders: false, // Only their orders
    canRouteProducts: false,
    canLockProducts: false,
    canEditPricing: false,
    canViewPricing: true, // Can see pricing
    canUploadMedia: true, // Reference materials
    canAddNotes: true, // Feedback
    canDeleteMedia: false,
    canApproveItems: true, // Approve samples
    canRejectItems: true, // Request changes
    canUpdateOrderStatus: true, // Limited status updates
    canUpdateProductStatus: false,
    canSendToManufacturer: false, // Through admin only
    canSendToClient: false,
    canCommunicateWithClient: false,
    canCommunicateWithManufacturer: false, // No direct contact
    canManageProducts: false,
    canManageVariants: false,
    canManageUsers: false,
    canViewAuditLog: false, // Limited history
  },
};

// Helper function to get permissions for a role
export function getPermissions(role: string | null | undefined): RolePermissions {
  if (!role) {
    // Return most restrictive permissions if no role
    return {
      canCreateOrders: false,
      canEditOrders: false,
      canDeleteOrders: false,
      canViewAllOrders: false,
      canRouteProducts: false,
      canLockProducts: false,
      canEditPricing: false,
      canViewPricing: false,
      canUploadMedia: false,
      canAddNotes: false,
      canDeleteMedia: false,
      canApproveItems: false,
      canRejectItems: false,
      canUpdateOrderStatus: false,
      canUpdateProductStatus: false,
      canSendToManufacturer: false,
      canSendToClient: false,
      canCommunicateWithClient: false,
      canCommunicateWithManufacturer: false,
      canManageProducts: false,
      canManageVariants: false,
      canManageUsers: false,
      canViewAuditLog: false,
    };
  }
  
  return ROLE_PERMISSIONS[role] || getPermissions(null);
}

// Check if user has any of the specified permissions
export function hasAnyPermission(
  role: string | null | undefined, 
  permissions: (keyof RolePermissions)[]
): boolean {
  const userPerms = getPermissions(role);
  return permissions.some(perm => userPerms[perm]);
}

// Check if user has all of the specified permissions
export function hasAllPermissions(
  role: string | null | undefined, 
  permissions: (keyof RolePermissions)[]
): boolean {
  const userPerms = getPermissions(role);
  return permissions.every(perm => userPerms[perm]);
}
