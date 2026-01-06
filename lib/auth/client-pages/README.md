# Client Portal Pages Reference

These are the client-facing pages from the factory-orders app. Use these as reference to build the client portal.

## Files

| File | Original Path | Description |
|------|---------------|-------------|
| `dashboard.tsx` | `/dashboard` | Client dashboard with stats, pending approvals |
| `orders/page.tsx` | `/dashboard/orders/client` | Client orders list with tabs (Orders, Shipped, Samples, Products) |
| `orders/order-detail.tsx` | `/dashboard/orders/client/[id]` | Single order detail view |
| `invoices/page.tsx` | `/dashboard/invoices/client` | Client invoices list with payment links |

## Key Features

### Dashboard (`dashboard.tsx`)
- Shows pending products awaiting approval
- Total orders count
- Pending invoices count
- Orders needing attention list

### Orders List (`orders/page.tsx`)
- 4 tabs: Orders, Shipped, Samples, Products
- Product approval workflow
- Sample approval workflow
- Media viewing modal
- ETA calculations
- Tracking links (DHL, UPS, FedEx, USPS)

### Order Detail (`orders/order-detail.tsx`)
- Order summary with total
- Product list with variants
- Sample approval button
- Shipping method display

### Invoices (`invoices/page.tsx`)
- Outstanding balance header
- Invoice list with status badges
- PDF viewer modal
- Pay Now links (Square integration)

## Setup in New Portal

1. **Copy these files** to your new portal's `app/dashboard/` folder

2. **Update imports** - change:
   ```tsx
   // From:
   import { supabase } from '@/lib/supabase';

   // To:
   import { supabase } from '@/lib/auth';
   ```

3. **Update auth checks** - change:
   ```tsx
   // From:
   const userData = localStorage.getItem('user');

   // To:
   import { getCurrentUser } from '@/lib/auth';
   const user = getCurrentUser();
   ```

4. **Remove role checks** (client portal is client-only):
   ```tsx
   // Remove this check since all users are clients:
   if (user.role !== 'client') {
     router.push('/dashboard');
     return;
   }
   ```

## Dependencies Used

These pages use:
- `lucide-react` - Icons
- `next/navigation` - Router, params
- Supabase client from `@/lib/auth`

## Database Tables Queried

- `clients` - Client info
- `orders` - Order data
- `order_products` - Products in orders
- `order_items` - Variants/quantities
- `order_media` - Product images
- `invoices` - Invoice data
- `client_notes` - Order notes/comments

## Quick Start

```tsx
// Example: Client Orders Page
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getCurrentUser } from '@/lib/auth';

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.push('/');
      return;
    }
    fetchOrders(user.email);
  }, []);

  const fetchOrders = async (email: string) => {
    // Get client ID
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('email', email)
      .single();

    if (!client) return;

    // Get orders
    const { data } = await supabase
      .from('orders')
      .select('*, order_products(*)')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false });

    setOrders(data || []);
  };

  return (
    <div>
      {orders.map(order => (
        <div key={order.id}>{order.order_number}</div>
      ))}
    </div>
  );
}
```
