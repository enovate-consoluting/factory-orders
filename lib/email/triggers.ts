export async function sendAutomatedEmails(orderId: string, trigger: string) {
  switch (trigger) {
    case 'order_submitted':
      // Auto-send to manufacturer when order is submitted
      await fetch('/api/email/send-to-manufacturer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, includeAttachments: true }),
      });
      break;
      
    case 'order_approved':
      // Auto-send to client when all items are approved
      await fetch('/api/email/send-to-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId, 
          customMessage: 'Great news! Your order has been approved and is now in production.',
          showPricing: true 
        }),
      });
      break;
  }
}