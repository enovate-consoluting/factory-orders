// lib/utils/orderUtils.ts
// This is your EXISTING file with new functions added

// ===== EXISTING FUNCTIONS =====

export function formatOrderNumber(orderNumber: string, clientName?: string): string {
  if (!orderNumber) return 'N/A';
  
  // Clean up malformed numbers (NaN issues)
  const cleaned = orderNumber.replace(/000NaN|NaN/g, '');
  
  // If we have client name and it's not a draft, we could update prefix
  // But generally we should preserve what's in the database
  const parts = cleaned.split('-');
  if (parts.length !== 2) return cleaned;
  
  const [prefix, number] = parts;
  
  // Ensure number is 6 digits
  const paddedNumber = number.padStart(6, '0');
  
  return `${prefix}-${paddedNumber}`;
}

export function formatCurrency(amount: number | null | undefined): string {
  if (!amount) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

export function calculateMargin(cost: number, clientPrice: number): number {
  if (!cost || cost === 0) return 0;
  return Math.round(((clientPrice - cost) / cost) * 100);
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100',
    submitted: 'bg-blue-100',
    submitted_to_manufacturer: 'bg-blue-100',
    priced_by_manufacturer: 'bg-purple-100',
    submitted_to_client: 'bg-yellow-100',
    client_approved: 'bg-green-100',
    ready_for_production: 'bg-green-100',
    in_production: 'bg-indigo-100',
    completed: 'bg-green-100',
    rejected: 'bg-red-100',
  };
  return colors[status] || 'bg-gray-100';
}

export function getWorkflowLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    submitted_to_manufacturer: 'Sent to Manufacturer',
    priced_by_manufacturer: 'Priced',
    submitted_to_client: 'Sent to Client',
    client_approved: 'Client Approved',
    ready_for_production: 'Ready for Production',
    in_production: 'In Production',
    completed: 'Completed',
    rejected: 'Rejected'
  };
  return labels[status] || status;
}

// ===== NEW FUNCTIONS FOR DRAFT CONVERSION =====

/**
 * Convert a draft order number to a real order number
 * Keeps the same number, just changes the prefix
 * Example: DRAFT-001203 becomes HAL-001203
 */
export function convertDraftOrderNumber(
  draftOrderNumber: string,
  clientName: string
): string {
  if (!draftOrderNumber.startsWith('DRAFT-')) {
    return draftOrderNumber; // Not a draft, return as-is
  }
  
  // Extract the number part (e.g., "001203")
  const numberPart = draftOrderNumber.split('-')[1];
  
  // Get client prefix (first 3 letters)
  const clientPrefix = clientName.substring(0, 3).toUpperCase();
  
  // Return new order number with same number
  return `${clientPrefix}-${numberPart}`;
}

/**
 * Generate the next sequential order number
 * This should be called when creating a NEW order (not converting draft)
 */
export async function generateNextOrderNumber(
  supabase: any,
  isDraft: boolean,
  clientName?: string
): Promise<string> {
  // Get the highest existing number across ALL orders
  const { data: orders } = await supabase
    .from('orders')
    .select('order_number')
    .order('created_at', { ascending: false })
    .limit(100); // Check last 100 orders

  let nextNumber = 1200; // Starting number

  if (orders && orders.length > 0) {
    // Find the highest number regardless of prefix
    const numbers = orders
      .map((o: any) => {
        // Extract just the number part after the dash
        const match = o.order_number.match(/-(\d{6})$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter((n: number) => n > 0);
    
    if (numbers.length > 0) {
      nextNumber = Math.max(...numbers) + 1;
    }
  }

  // Format with appropriate prefix
  const prefix = isDraft ? 'DRAFT' : (clientName ? clientName.substring(0, 3).toUpperCase() : 'ORD');
  return `${prefix}-${nextNumber.toString().padStart(6, '0')}`;
}