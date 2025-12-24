import { useState, useEffect } from 'react';
import { X, Mail, Send, FileText, AlertCircle, MessageSquare, Phone, Smartphone, Globe, CreditCard, Edit2, Check, Loader2 } from 'lucide-react';

interface SendInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: { 
    method: 'email' | 'sms' | 'both';
    to: string[];
    cc?: string[];
    phone?: string;
    includePaymentLink?: boolean;
    paymentUrl?: string;
    emailMessage?: string;
    smsMessage?: string;
  }) => void;
  invoiceData: any;
  billToEmail: string;
  billToName: string;
  billToPhone?: string;
  invoiceTotal: number;
  selectedProducts: any[];
  customItems?: any[];
  onSuccess?: (message: string) => void; // NEW: Callback for success notification
}

export default function SendInvoiceModal({
  isOpen,
  onClose,
  onSend,
  invoiceData,
  billToEmail,
  billToName,
  billToPhone = '',
  invoiceTotal,
  selectedProducts,
  customItems = [],
  onSuccess // NEW: Accept success callback
}: SendInvoiceModalProps) {
  const [sendMethod, setSendMethod] = useState<'email' | 'sms' | 'both'>('email');
  const [toEmails, setToEmails] = useState(billToEmail);
  const [ccEmails, setCcEmails] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(billToPhone);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  
  // New states for customization
  const [includePaymentLink, setIncludePaymentLink] = useState(true);
  const [customizeEmail, setCustomizeEmail] = useState(false);
  const [customizeSMS, setCustomizeSMS] = useState(false);
  const [emailMessage, setEmailMessage] = useState('Thank you for your order! Please find your invoice details below.');
  const [smsMessage, setSmsMessage] = useState('');
  
  // Square payment states
  const [creatingPaymentLink, setCreatingPaymentLink] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  
  // SMS sending state
  const [sendingSMS, setSendingSMS] = useState(false);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    };
  }, [isOpen]);

  // SYNC STATE: Update fields when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setToEmails(billToEmail);
      setPhoneNumber(billToPhone);
      // Reset other states when modal opens fresh
      setError('');
      setPaymentUrl('');
    }
  }, [isOpen, billToEmail, billToPhone]);

  if (!isOpen) return null;

  // Function to send SMS via Twilio API
  const sendSMS = async (phone: string, message: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('Sending SMS to:', phone);
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phone,
          message: message,
          invoiceNumber: invoiceData.invoiceNumber || invoiceData.invoice_number,
          invoiceId: invoiceData.id
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('SMS sent successfully:', data.data?.sid);
        return { success: true };
      } else {
        console.error('SMS send failed:', data.error);
        return { success: false, error: data.error };
      }
    } catch (error: any) {
      console.error('SMS send error:', error);
      return { success: false, error: error.message || 'Failed to send SMS' };
    }
  };

  // Helper function to show success and close modal
  const handleSuccess = (message: string) => {
    // Call the success callback if provided
    if (onSuccess) {
      onSuccess(message);
    }
    // Close the modal
    onClose();
  };

  const handleSend = async () => {
    setError('');
    
    // Validate based on send method
    if (sendMethod === 'email' || sendMethod === 'both') {
      const toList = toEmails.split(',').map(e => e.trim()).filter(e => e);
      if (toList.length === 0) {
        setError('Please enter at least one recipient email');
        return;
      }
    }
    
    if (sendMethod === 'sms' || sendMethod === 'both') {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        setError('Please enter a valid phone number');
        return;
      }
    }
    
    try {
      setSending(true);
      let squarePaymentUrl = '';
      let smsSent = false;
      let emailSent = false;
      
      // Create Square payment link if requested
      if (includePaymentLink) {
        setCreatingPaymentLink(true);
        try {
          const currentEmail = toEmails.split(',')[0].trim() || billToEmail;
          
          const paymentResponse = await fetch('/api/square/direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              invoiceNumber: invoiceData.invoiceNumber || invoiceData.invoice_number,
              amount: invoiceTotal,
              customerEmail: currentEmail,
              customerName: billToName || 'Customer'
            })
          });
          
          const paymentData = await paymentResponse.json();
          
          if (paymentData.success && paymentData.checkoutUrl) {
            squarePaymentUrl = paymentData.checkoutUrl;
            setPaymentUrl(squarePaymentUrl);
            console.log('Square payment link created:', squarePaymentUrl);
          } else {
            console.error('Failed to create Square payment link:', paymentData.error);
          }
        } catch (paymentError) {
          console.error('Error creating payment link:', paymentError);
        } finally {
          setCreatingPaymentLink(false);
        }
      }
      
      // === SEND SMS IF SELECTED ===
      if (sendMethod === 'sms' || sendMethod === 'both') {
        setSendingSMS(true);
        
        // Build SMS message
        const invoiceNumber = invoiceData.invoiceNumber || invoiceData.invoice_number;
        const dueDate = new Date(invoiceData.dueDate).toLocaleDateString();
        const orderName = invoiceData.order?.order_name || invoiceData.order?.order_number || '';
        
        let smsText = `BirdHaus Invoice #${invoiceNumber}\n`;
        if (orderName) smsText += `Order: ${orderName}\n`;
        smsText += `Amount Due: $${finalTotal.toFixed(2)}\n`;
        smsText += `Due: ${dueDate}`;
        
        if (includePaymentLink && squarePaymentUrl) {
          smsText += `\n\nPay Now: ${squarePaymentUrl}`;
        }
        
        if (customizeSMS && smsMessage) {
          smsText += `\n\n${smsMessage}`;
        }
        
        smsText += `\n\nThank you for your business!`;
        
        const smsResult = await sendSMS(phoneNumber, smsText);
        
        if (smsResult.success) {
          smsSent = true;
          console.log('SMS sent successfully!');
        } else {
          if (sendMethod === 'sms') {
            setError(`SMS failed: ${smsResult.error}`);
            setSending(false);
            setSendingSMS(false);
            return;
          } else {
            console.warn('SMS failed but continuing with email:', smsResult.error);
          }
        }
        
        setSendingSMS(false);
      }
      
      // === SEND EMAIL IF SELECTED ===
      if (sendMethod === 'email' || sendMethod === 'both') {
        const toList = toEmails.split(',').map(e => e.trim()).filter(e => e);
        const ccList = ccEmails.split(',').map(e => e.trim()).filter(e => e);
        
        await onSend({
          method: sendMethod,
          to: toList,
          cc: ccList,
          phone: phoneNumber.replace(/\D/g, ''),
          includePaymentLink,
          paymentUrl: squarePaymentUrl,
          emailMessage: customizeEmail ? emailMessage : undefined,
          smsMessage: customizeSMS ? smsMessage : undefined
        });
        
        emailSent = true;
      }
      
      // === SHOW SUCCESS AND CLOSE ===
      setSending(false);
      
      // Determine success message
      let successMessage = '';
      if (sendMethod === 'sms' && smsSent) {
        successMessage = 'SMS sent successfully!';
      } else if (sendMethod === 'email' && emailSent) {
        successMessage = 'Email sent successfully!';
      } else if (sendMethod === 'both') {
        if (smsSent && emailSent) {
          successMessage = 'Email and SMS sent successfully!';
        } else if (emailSent) {
          successMessage = 'Email sent successfully! (SMS failed)';
        } else if (smsSent) {
          successMessage = 'SMS sent successfully! (Email failed)';
        }
      }
      
      // Close modal and show success
      if (successMessage) {
        handleSuccess(successMessage);
      }
      
    } catch (error) {
      console.error('Error in handleSend:', error);
      setError('Failed to send invoice. Please try again.');
      setSending(false);
      setCreatingPaymentLink(false);
      setSendingSMS(false);
    }
  };

  // Calculate ALL items including custom items for preview
  const invoiceItems: any[] = [];
  
  selectedProducts.forEach(product => {
    const totalQty = product.order_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
    
    const clientPrice = product.client_product_price || 0;
    const clientAirPrice = product.client_shipping_air_price || 0;
    const clientBoatPrice = product.client_shipping_boat_price || 0;
    
    if (product.sample_fee > 0) {
      invoiceItems.push({
        description: `${product.description || product.product?.title || 'Product'} - Sample Fee`,
        quantity: 1,
        price: product.sample_fee,
        total: product.sample_fee
      });
    }
    
    if (clientPrice > 0 && totalQty > 0) {
      invoiceItems.push({
        description: `${product.description || product.product?.title || 'Product'} - Production`,
        quantity: totalQty,
        price: clientPrice,
        total: clientPrice * totalQty
      });
    }
    
    if (product.selected_shipping_method === 'air' && clientAirPrice > 0) {
      invoiceItems.push({
        description: `${product.description || product.product?.title || 'Product'} - Air Shipping`,
        quantity: 1,
        price: clientAirPrice,
        total: clientAirPrice
      });
    } else if (product.selected_shipping_method === 'boat' && clientBoatPrice > 0) {
      invoiceItems.push({
        description: `${product.description || product.product?.title || 'Product'} - Boat Shipping`,
        quantity: 1,
        price: clientBoatPrice,
        total: clientBoatPrice
      });
    }
  });
  
  if (customItems && customItems.length > 0) {
    customItems.forEach(item => {
      if (item.amount > 0) {
        invoiceItems.push({
          description: item.description || 'Custom Item',
          quantity: item.quantity || 1,
          price: item.amount,
          total: item.amount * (item.quantity || 1)
        });
      }
    });
  }
  
  const calculatedTotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
  const finalTotal = Math.max(invoiceTotal, calculatedTotal);

  const formatPhoneDisplay = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11 && cleaned[0] === '1') {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const invoiceNumber = invoiceData.invoiceNumber || invoiceData.invoice_number;
  const orderName = invoiceData.order?.order_name || invoiceData.order?.order_number || '';
  
  let smsPreviewText = `BirdHaus Invoice #${invoiceNumber}\n`;
  if (orderName) smsPreviewText += `Order: ${orderName}\n`;
  smsPreviewText += `Amount Due: $${finalTotal.toFixed(2)}\n`;
  smsPreviewText += `Due: ${new Date(invoiceData.dueDate).toLocaleDateString()}`;
  
  if (includePaymentLink) {
    smsPreviewText += `\n\nPay Now: ${paymentUrl || '[Payment link will be generated]'}`;
  }
  
  if (customizeSMS && smsMessage) {
    smsPreviewText += `\n\n${smsMessage}`;
  }
  
  smsPreviewText += `\n\nThank you for your business!`;
  
  const smsCharCount = smsPreviewText.length;
  const smsSegments = Math.ceil(smsCharCount / 160);

  return (
    // FIXED: More transparent background - no dark overlay
    <div className="fixed inset-0 bg-white/30 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-gray-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-400 to-blue-500 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/90 backdrop-blur rounded-lg flex items-center justify-center p-1">
              <img 
                src="/birdhaus-icon.png" 
                alt="BirdHaus" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = '<span class="text-blue-400 font-bold text-lg">BH</span>';
                }}
              />
            </div>
            <h2 className="text-xl font-bold text-white">Send Invoice</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            disabled={sending || creatingPaymentLink}
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Send Method Tabs */}
        <div className="bg-gray-50 border-b p-3">
          <div className="flex gap-1 bg-gray-200/50 rounded-lg p-1">
            <button
              onClick={() => setSendMethod('email')}
              disabled={sending || creatingPaymentLink}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-all flex-1 ${
                sendMethod === 'email'
                  ? 'bg-white text-blue-500 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              } disabled:opacity-50`}
            >
              <Mail className="w-4 h-4" />
              Email
            </button>
            {/* SMS buttons temporarily hidden - SMS service needs configuration
            <button
              onClick={() => setSendMethod('sms')}
              disabled={sending || creatingPaymentLink}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-all flex-1 ${
                sendMethod === 'sms'
                  ? 'bg-white text-blue-500 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              } disabled:opacity-50`}
            >
              <MessageSquare className="w-4 h-4" />
              SMS
            </button>
            <button
              onClick={() => setSendMethod('both')}
              disabled={sending || creatingPaymentLink}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-all flex-1 ${
                sendMethod === 'both'
                  ? 'bg-white text-blue-500 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              } disabled:opacity-50`}
            >
              <Smartphone className="w-4 h-4" />
              Both
            </button>
            */}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Recipients Section */}
          <div className="mb-4 bg-blue-50/50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Recipients</h3>
            
            {(sendMethod === 'email' || sendMethod === 'both') && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Email To: (comma separated)
                  </label>
                  <input
                    type="text"
                    value={toEmails}
                    onChange={(e) => setToEmails(e.target.value)}
                    disabled={sending || creatingPaymentLink}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-900 placeholder-gray-500 disabled:opacity-50"
                    placeholder="client@example.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">This email will be used for Square payment notifications</p>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    CC: (optional)
                  </label>
                  <input
                    type="text"
                    value={ccEmails}
                    onChange={(e) => setCcEmails(e.target.value)}
                    disabled={sending || creatingPaymentLink}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-900 placeholder-gray-500 disabled:opacity-50"
                    placeholder="accounting@example.com"
                  />
                </div>
              </div>
            )}
            
            {(sendMethod === 'sms' || sendMethod === 'both') && (
              <div className={sendMethod === 'both' ? 'mt-3 pt-3 border-t border-blue-200' : ''}>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <Phone className="w-3 h-3 inline mr-1" />
                  SMS Phone Number:
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={sending || creatingPaymentLink}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-900 placeholder-gray-500 disabled:opacity-50"
                  placeholder="(555) 123-4567"
                />
                <p className="text-xs text-gray-500 mt-1">US numbers supported • Include area code</p>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
          </div>

          {/* Options Section */}
          <div className="mb-4 bg-gray-50/50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Options</h3>
            
            <div className="space-y-3">
              {/* Payment Link Option */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePaymentLink}
                  onChange={(e) => setIncludePaymentLink(e.target.checked)}
                  disabled={sending || creatingPaymentLink}
                  className="w-4 h-4 text-blue-500 rounded disabled:opacity-50"
                />
                <span className="text-sm text-gray-700">Include payment link</span>
                <span className="text-xs text-gray-500">(Square checkout - Total: ${finalTotal.toFixed(2)})</span>
                {creatingPaymentLink && (
                  <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                )}
                {paymentUrl && (
                  <Check className="w-3 h-3 text-green-500" />
                )}
              </label>
              
              {/* Custom Email Message */}
              {(sendMethod === 'email' || sendMethod === 'both') && (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={customizeEmail}
                      onChange={(e) => setCustomizeEmail(e.target.checked)}
                      disabled={sending || creatingPaymentLink}
                      className="w-4 h-4 text-blue-500 rounded disabled:opacity-50"
                    />
                    <span className="text-sm text-gray-700">Customize email message</span>
                    <Edit2 className="w-3 h-3 text-gray-400" />
                  </label>
                  {customizeEmail && (
                    <textarea
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      disabled={sending || creatingPaymentLink}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-900 disabled:opacity-50"
                      rows={2}
                      placeholder="Custom message for email..."
                    />
                  )}
                </div>
              )}
              
              {/* Custom SMS Message */}
              {(sendMethod === 'sms' || sendMethod === 'both') && (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={customizeSMS}
                      onChange={(e) => setCustomizeSMS(e.target.checked)}
                      disabled={sending || creatingPaymentLink}
                      className="w-4 h-4 text-blue-500 rounded disabled:opacity-50"
                    />
                    <span className="text-sm text-gray-700">Add custom SMS message</span>
                    <Edit2 className="w-3 h-3 text-gray-400" />
                  </label>
                  {customizeSMS && (
                    <textarea
                      value={smsMessage}
                      onChange={(e) => setSmsMessage(e.target.value)}
                      disabled={sending || creatingPaymentLink}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-900 disabled:opacity-50"
                      rows={2}
                      placeholder="Additional message for SMS..."
                      maxLength={60}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Preview Section */}
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            {/* Email Preview */}
            {(sendMethod === 'email' || sendMethod === 'both') && (
              <div className={sendMethod === 'both' ? 'border-b border-gray-200' : ''}>
                <div className="bg-gray-50 px-4 py-2 border-b">
                  <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Preview
                  </h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Subject: Invoice {invoiceData.invoiceNumber || invoiceData.invoice_number} - {invoiceData.order?.order_name || invoiceData.order?.order_number}
                  </p>
                </div>
                
                <div className="p-4 bg-white">
                  {/* Branded Email Header */}
                  <div className="bg-gradient-to-r from-blue-400 to-blue-500 rounded-t-lg p-4 text-center">
                    <div className="inline-flex items-center justify-center bg-white/95 rounded-lg px-4 py-2 mb-2">
                      <img 
                        src="/birdhaus-logo.png" 
                        alt="BirdHaus"
                        className="h-8"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML = '<span class="text-blue-400 font-bold text-2xl">BirdHaus</span>';
                        }}
                      />
                    </div>
                    <h2 className="text-white text-xl font-bold">Invoice {invoiceData.invoiceNumber || invoiceData.invoice_number}</h2>
                  </div>
                  
                  <div className="border border-t-0 border-gray-200 rounded-b-lg p-4">
                    <p className="text-gray-900 font-medium text-sm">Dear {billToName},</p>
                    
                    <p className="text-gray-700 mt-3 text-sm">
                      {emailMessage}
                    </p>
                    
                    {/* Invoice Summary Card */}
                    <div className="my-4 bg-blue-50/50 border border-blue-200 rounded-lg p-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">Order:</span>
                          <p className="font-semibold text-gray-900">{invoiceData.order?.order_name || invoiceData.order?.order_number}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Due Date:</span>
                          <p className="font-semibold text-gray-900">{new Date(invoiceData.dueDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <span className="text-gray-600 text-sm">Total Amount:</span>
                        <p className="text-2xl font-bold text-blue-600">${finalTotal.toFixed(2)}</p>
                      </div>
                      
                      {includePaymentLink && (
                        <div className="mt-3">
                          <div className="bg-green-500 text-white text-center py-2 px-4 rounded-lg font-medium text-sm">
                            <CreditCard className="w-4 h-4 inline-block mr-2" />
                            Pay Now with Square
                          </div>
                          <p className="text-xs text-gray-500 text-center mt-1">
                            {paymentUrl ? 'Secure checkout link included' : 'Click to pay securely online'}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Items Table */}
                    <div className="my-4">
                      <h4 className="font-semibold text-gray-900 text-sm mb-2">Invoice Details:</h4>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left py-1.5 px-2 text-gray-700 font-medium">Item</th>
                              <th className="text-center py-1.5 px-2 text-gray-700 font-medium">Qty</th>
                              <th className="text-right py-1.5 px-2 text-gray-700 font-medium">Price</th>
                              <th className="text-right py-1.5 px-2 text-gray-700 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoiceItems.map((item, idx) => (
                              <tr key={idx} className="border-t border-gray-100">
                                <td className="py-1.5 px-2 text-gray-700">{item.description}</td>
                                <td className="text-center py-1.5 px-2 text-gray-700">{item.quantity}</td>
                                <td className="text-right py-1.5 px-2 text-gray-600">${item.price.toFixed(2)}</td>
                                <td className="text-right py-1.5 px-2 text-gray-900 font-medium">${item.total.toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-gray-200 bg-gray-50">
                              <td colSpan={3} className="py-1.5 px-2 text-right font-semibold text-gray-900">Total:</td>
                              <td className="py-1.5 px-2 text-right font-bold text-gray-900">${finalTotal.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-200 pt-3 mt-4">
                      <p className="text-xs text-gray-600 text-center">
                        © 2024 BirdHaus - Order Management System
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Attachment Note */}
                <div className="bg-gray-50 px-4 py-2 border-t">
                  <div className="flex items-center gap-2 text-xs">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">PDF Invoice will be attached</span>
                  </div>
                </div>
              </div>
            )}

            {/* SMS Preview */}
            {(sendMethod === 'sms' || sendMethod === 'both') && (
              <div>
                <div className="bg-gray-50 px-4 py-2 border-b">
                  <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    SMS Preview
                    {sendingSMS && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                  </h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    To: {formatPhoneDisplay(phoneNumber) || 'Enter phone number'}
                  </p>
                </div>
                
                <div className="p-4 bg-white">
                  {/* Phone Frame */}
                  <div className="max-w-xs mx-auto">
                    <div className="bg-gray-100 rounded-2xl p-4 shadow-inner">
                      <div className="bg-white rounded-xl p-3">
                        <div className="bg-blue-500 text-white rounded-lg p-2 text-sm inline-block max-w-full whitespace-pre-wrap">
                          {smsPreviewText}
                        </div>
                        
                        <div className="mt-2 text-xs text-gray-500">
                          {smsCharCount} characters • {smsSegments} SMS {smsSegments > 1 ? 'segments' : 'segment'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-2 text-center">
                      <p className="text-xs text-gray-500">
                        Standard SMS rates apply
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
          <div className="text-xs text-gray-600">
            {creatingPaymentLink && 'Creating Square payment link...'}
            {sendingSMS && 'Sending SMS via Twilio...'}
            {!creatingPaymentLink && !sendingSMS && sendMethod === 'email' && 'Invoice PDF will be attached to email'}
            {!creatingPaymentLink && !sendingSMS && sendMethod === 'sms' && (includePaymentLink ? 'Square payment link will be sent via SMS' : 'Invoice details will be sent via SMS')}
            {!creatingPaymentLink && !sendingSMS && sendMethod === 'both' && 'Email with PDF + SMS with payment link'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={sending || creatingPaymentLink || sendingSMS}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || creatingPaymentLink || sendingSMS}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingPaymentLink ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating payment link...
                </>
              ) : sendingSMS ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending SMS...
                </>
              ) : sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send {sendMethod === 'both' ? 'Email & SMS' : sendMethod.toUpperCase()}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}