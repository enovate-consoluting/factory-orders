// lib/square-utils.ts
export async function createSquarePaymentLink(
  invoiceData: {
    invoiceNumber: string;
    amount: number;
    customerEmail: string;
    customerName: string;
    orderNumber?: string;
  }
) {
  try {
    const response = await fetch('/api/square/payment-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoiceNumber: invoiceData.invoiceNumber,
        amount: invoiceData.amount,
        customerEmail: invoiceData.customerEmail,
        customerName: invoiceData.customerName,
        description: `Payment for Order ${invoiceData.orderNumber || invoiceData.invoiceNumber}`
      })
    });

    const data = await response.json();
    
    if (data.success) {
      return {
        success: true,
        paymentUrl: data.paymentUrl,
        paymentLinkId: data.paymentLinkId
      };
    } else {
      console.error('Failed to create payment link:', data.error);
      return {
        success: false,
        error: data.error
      };
    }
  } catch (error) {
    console.error('Error creating payment link:', error);
    return {
      success: false,
      error: 'Failed to create payment link'
    };
  }
}

// Check if payment was completed
export async function checkPaymentStatus(paymentLinkId: string) {
  try {
    const response = await fetch(`/api/square/payment-link?id=${paymentLinkId}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking payment status:', error);
    return { success: false, error: 'Failed to check payment status' };
  }
}
