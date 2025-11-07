import { useState } from 'react';
import { X, Mail, Send, FileText, AlertCircle } from 'lucide-react';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (emails: { to: string[], cc: string[] }) => void;
  invoiceData: any;
  billToEmail: string;
  billToName: string;
  invoiceTotal: number;
  selectedProducts: any[];
}

export default function EmailPreviewModal({
  isOpen,
  onClose,
  onSend,
  invoiceData,
  billToEmail,
  billToName,
  invoiceTotal,
  selectedProducts
}: EmailPreviewModalProps) {
  const [toEmails, setToEmails] = useState(billToEmail);
  const [ccEmails, setCcEmails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSend = async () => {
    console.log('Send button clicked');
    setError('');
    
    const toList = toEmails.split(',').map(e => e.trim()).filter(e => e);
    const ccList = ccEmails.split(',').map(e => e.trim()).filter(e => e);
    
    if (toList.length === 0) {
      setError('Please enter at least one recipient email');
      return;
    }
    
    try {
      setSending(true);
      console.log('Sending email to:', toList, 'CC:', ccList);
      await onSend({ to: toList, cc: ccList });
    } catch (error) {
      console.error('Error in handleSend:', error);
      setError('Failed to send invoice. Check console for details.');
    } finally {
      setSending(false);
    }
  };

  // Calculate items for preview
  const invoiceItems = selectedProducts.map(product => {
    const totalQty = product.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    const items = [];
    
    if (product.sample_fee > 0) {
      items.push({
        description: `${product.product.title} - Sample Fee`,
        quantity: 1,
        price: product.sample_fee,
        total: product.sample_fee
      });
    }
    
    if (product.product_price > 0 && totalQty > 0) {
      items.push({
        description: `${product.product.title} - Production`,
        quantity: totalQty,
        price: product.product_price,
        total: product.product_price * totalQty
      });
    }
    
    return items;
  }).flat();

  return (
    <div className="fixed inset-0 bg-gray-100 bg-opacity-20 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Email Invoice Preview</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Email Settings */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email Settings
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To: (comma separated for multiple)
                </label>
                <input
                  type="text"
                  value={toEmails}
                  onChange={(e) => setToEmails(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  placeholder="client@example.com, manager@example.com"
                />
                <p className="text-xs text-gray-500 mt-1">Default: {billToEmail}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CC: (optional, comma separated)
                </label>
                <input
                  type="text"
                  value={ccEmails}
                  onChange={(e) => setCcEmails(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  placeholder="accounting@example.com"
                />
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900">Testing Mode</p>
                  <p className="text-sm text-yellow-700">
                    You can change the recipient emails for testing. This feature will be disabled in production.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Email Preview */}
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <div className="bg-gray-50 p-4 border-b">
              <h3 className="font-semibold text-gray-900">Email Preview</h3>
              <p className="text-sm text-gray-600 mt-1">
                Subject: Invoice {invoiceData.invoiceNumber} - {invoiceData.order.order_name || invoiceData.order.order_number}
              </p>
            </div>
            
            <div className="p-6 bg-white">
              {/* Email Body Preview */}
              <div className="prose max-w-none">
                <p className="text-gray-900 font-medium">Dear {billToName},</p>
                
                <p className="text-gray-800 mt-4">
                  Please find attached invoice #{invoiceData.invoiceNumber} for your recent order.
                </p>
                
                <div className="my-6 bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3">Invoice Summary:</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700 font-medium">Invoice Number:</span>
                      <span className="font-medium text-gray-900">{invoiceData.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 font-medium">Order:</span>
                      <span className="font-medium text-gray-900">{invoiceData.order.order_name || invoiceData.order.order_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 font-medium">Due Date:</span>
                      <span className="font-medium text-gray-900">{new Date(invoiceData.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-300">
                      <span className="text-gray-900">Total Due:</span>
                      <span className="text-blue-700 font-bold">${invoiceTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="my-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Items:</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-gray-700 font-medium">Description</th>
                        <th className="text-center py-2 text-gray-700 font-medium">Qty</th>
                        <th className="text-right py-2 text-gray-700 font-medium">Price</th>
                        <th className="text-right py-2 text-gray-700 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems.map((item, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="py-2 text-gray-800">{item.description}</td>
                          <td className="text-center py-2 text-gray-800">{item.quantity}</td>
                          <td className="text-right py-2 text-gray-800">${item.price.toFixed(2)}</td>
                          <td className="text-right py-2 text-gray-800 font-medium">${item.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <p className="text-gray-800 mt-6">
                  If you have any questions about this invoice, please don't hesitate to contact us.
                </p>
                
                <p className="text-gray-800 mt-4">
                  Thank you for your business!
                </p>
                
                <div className="mt-6 text-sm text-gray-700">
                  <p>Best regards,</p>
                  <p className="font-semibold text-gray-900">The BirdHaus Team</p>
                </div>
              </div>
            </div>
            
            {/* Attachment Preview */}
            <div className="bg-gray-50 p-4 border-t">
              <h4 className="font-semibold text-gray-900 mb-2">Attachments:</h4>
              <div className="flex items-center gap-3 text-sm">
                <FileText className="w-5 h-5 text-gray-400" />
                <span className="text-gray-700">Invoice_{invoiceData.invoiceNumber}.pdf</span>
                <span className="text-gray-500">(PDF will be generated and attached)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}