import React from 'react'

interface ManufacturerEmailProps {
  order: any
}

export const ManufacturerEmailTemplate: React.FC<ManufacturerEmailProps> = ({ order }) => {
  const totalItems = order.products?.reduce((sum: number, product: any) => 
    sum + product.items?.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0), 0
  ) || 0

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ backgroundColor: '#1e293b', color: '#ffffff', padding: '20px', borderRadius: '8px 8px 0 0' }}>
        <h1 style={{ margin: '0', fontSize: '24px' }}>New Factory Order</h1>
      </div>
      
      <div style={{ backgroundColor: '#f8fafc', padding: '20px', border: '1px solid #e2e8f0' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <h2 style={{ color: '#1e293b', fontSize: '18px', marginTop: '0' }}>Order Details</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tr>
              <td style={{ padding: '8px 0', color: '#64748b' }}>Order Number:</td>
              <td style={{ padding: '8px 0', color: '#1e293b', fontWeight: 'bold' }}>{order.order_number}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#64748b' }}>Client:</td>
              <td style={{ padding: '8px 0', color: '#1e293b' }}>{order.client?.name}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#64748b' }}>Date:</td>
              <td style={{ padding: '8px 0', color: '#1e293b' }}>{new Date(order.created_at).toLocaleDateString()}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#64748b' }}>Total Items:</td>
              <td style={{ padding: '8px 0', color: '#1e293b' }}>{totalItems}</td>
            </tr>
          </table>
        </div>

        {order.products?.map((product: any, index: number) => (
          <div key={index} style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <h3 style={{ color: '#1e293b', fontSize: '16px', marginTop: '0' }}>
              {product.product?.title} ({product.product_order_number})
            </h3>
            
            {product.items && product.items.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    <th style={{ padding: '8px', textAlign: 'left', color: '#475569', fontSize: '14px' }}>Variant</th>
                    <th style={{ padding: '8px', textAlign: 'left', color: '#475569', fontSize: '14px' }}>Quantity</th>
                    <th style={{ padding: '8px', textAlign: 'left', color: '#475569', fontSize: '14px' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {product.items.map((item: any, itemIndex: number) => (
                    <tr key={itemIndex} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px', color: '#1e293b', fontSize: '14px' }}>{item.variant_combo}</td>
                      <td style={{ padding: '8px', color: '#1e293b', fontSize: '14px' }}>{item.quantity}</td>
                      <td style={{ padding: '8px', color: '#64748b', fontSize: '14px' }}>{item.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            
            {product.media && product.media.length > 0 && (
              <p style={{ color: '#64748b', fontSize: '14px', marginTop: '10px' }}>
                📎 {product.media.length} reference file(s) attached
              </p>
            )}
          </div>
        ))}

        <div style={{ backgroundColor: '#3b82f6', color: '#ffffff', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Please review the order details and set your pricing.</p>
          <a href={`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/orders/${order.id}`} 
             style={{ 
               display: 'inline-block', 
               backgroundColor: '#ffffff', 
               color: '#3b82f6', 
               padding: '10px 20px', 
               borderRadius: '4px', 
               textDecoration: 'none',
               fontWeight: 'bold'
             }}>
            View Order Details
          </a>
        </div>
      </div>
    </div>
  )
}