import React from 'react'

interface ClientEmailProps {
  order: any
  message?: string
  showPricing?: boolean
}

export const ClientEmailTemplate: React.FC<ClientEmailProps> = ({ 
  order, 
  message, 
  showPricing = false 
}) => {
  const totalQuantity = order.products?.reduce((sum: number, product: any) => 
    sum + product.items?.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0), 0
  ) || 0

  const totalPrice = showPricing ? order.products?.reduce((sum: number, product: any) => 
    sum + product.items?.reduce((itemSum: number, item: any) => {
      const price = item.bulk_price || item.standard_price || 0
      return itemSum + (price * (item.quantity || 0))
    }, 0), 0
  ) || 0 : 0

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ backgroundColor: '#1e293b', color: '#ffffff', padding: '20px', borderRadius: '8px 8px 0 0' }}>
        <h1 style={{ margin: '0', fontSize: '24px' }}>Order Update</h1>
      </div>
      
      <div style={{ backgroundColor: '#f8fafc', padding: '20px', border: '1px solid #e2e8f0' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <p style={{ color: '#1e293b', fontSize: '16px', marginTop: '0' }}>
            Dear {order.client?.name},
          </p>
          
          {message && (
            <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6' }}>
              {message}
            </p>
          )}
          
          <p style={{ color: '#475569', fontSize: '14px' }}>
            Here's a summary of your order #{order.order_number}:
          </p>
          
          <div style={{ backgroundColor: '#f1f5f9', padding: '15px', borderRadius: '6px', marginTop: '15px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tr>
                <td style={{ padding: '5px 0', color: '#64748b', fontSize: '14px' }}>Total Products:</td>
                <td style={{ padding: '5px 0', color: '#1e293b', fontWeight: 'bold', fontSize: '14px' }}>
                  {order.products?.length || 0}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '5px 0', color: '#64748b', fontSize: '14px' }}>Total Quantity:</td>
                <td style={{ padding: '5px 0', color: '#1e293b', fontWeight: 'bold', fontSize: '14px' }}>
                  {totalQuantity} items
                </td>
              </tr>
              <tr>
                <td style={{ padding: '5px 0', color: '#64748b', fontSize: '14px' }}>Status:</td>
                <td style={{ padding: '5px 0', color: '#1e293b', fontWeight: 'bold', fontSize: '14px' }}>
                  {order.status?.toUpperCase()}
                </td>
              </tr>
              {showPricing && totalPrice > 0 && (
                <tr>
                  <td style={{ padding: '5px 0', color: '#64748b', fontSize: '14px' }}>Estimated Total:</td>
                  <td style={{ padding: '5px 0', color: '#1e293b', fontWeight: 'bold', fontSize: '14px' }}>
                    ${totalPrice.toFixed(2)}
                  </td>
                </tr>
              )}
            </table>
          </div>
          
          <p style={{ color: '#475569', fontSize: '14px', marginTop: '20px' }}>
            We'll keep you updated on the progress of your order.
          </p>
        </div>

        <div style={{ textAlign: 'center', padding: '20px', borderTop: '1px solid #e2e8f0' }}>
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0' }}>
            This is an automated message from BirdhausApp. Please do not reply to this email.
          </p>
        </div>
      </div>
    </div>
  )
}