'use client'

import { useState } from 'react'
import { X, Send, Loader2, Mail, Package, DollarSign } from 'lucide-react'

interface EmailModalProps {
  isOpen: boolean
  onClose: () => void
  orderId: string
  orderNumber: string
  recipientType: 'manufacturer' | 'client'
  recipientEmail: string
}

export default function EmailModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  recipientType,
  recipientEmail,
}: EmailModalProps) {
  const [sending, setSending] = useState(false)
  const [customMessage, setCustomMessage] = useState('')
  const [includeAttachments, setIncludeAttachments] = useState(true)
  const [showPricing, setShowPricing] = useState(false)
  const [customSubject, setCustomSubject] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSend = async () => {
    setSending(true)
    setError('')
    
    try {
      const endpoint = recipientType === 'manufacturer' 
        ? '/api/email/send-to-manufacturer'
        : '/api/email/send-to-client'

      const payload = recipientType === 'manufacturer'
        ? { orderId, includeAttachments }
        : { orderId, customMessage, showPricing, subject: customSubject }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email')
      }

      setSuccess(true)
      setTimeout(() => {
        onClose()
        setSuccess(false)
        setCustomMessage('')
        setCustomSubject('')
      }, 2000)
    } catch (err) {
      console.error('Error sending email:', err)
      setError(err instanceof Error ? err.message : 'Failed to send email. Please try again.')
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Mail className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">
                Send Email to {recipientType === 'manufacturer' ? 'Manufacturer' : 'Client'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white"
              disabled={sending}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-900 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Recipient</div>
            <div className="text-white font-medium">{recipientEmail}</div>
            <div className="text-sm text-slate-400 mt-2">Order #{orderNumber}</div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="text-sm text-blue-400">
              {recipientType === 'manufacturer' ? (
                <>
                  <Package className="w-4 h-4 inline mr-2" />
                  This will send a detailed order summary with all product specifications
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 inline mr-2" />
                  This will send a simplified order summary to the client
                </>
              )}
            </div>
          </div>

          {recipientType === 'manufacturer' ? (
            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAttachments}
                  onChange={(e) => setIncludeAttachments(e.target.checked)}
                  className="w-4 h-4 text-blue-500 bg-slate-700 border-slate-600 rounded"
                />
                <span className="text-white">Include reference files as attachments</span>
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Custom Subject (Optional)
                </label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder={`Update on Order #${orderNumber}`}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Custom Message (Optional)
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={4}
                  placeholder="Add a personalized message to the client..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPricing}
                  onChange={(e) => setShowPricing(e.target.checked)}
                  className="w-4 h-4 text-blue-500 bg-slate-700 border-slate-600 rounded"
                />
                <span className="text-white flex items-center">
                  <DollarSign className="w-4 h-4 mr-1" />
                  Include pricing information
                </span>
              </label>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="text-red-400 text-sm">{error}</div>
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="text-green-400 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Email sent successfully!
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || success}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending...</span>
              </>
            ) : success ? (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Sent!</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Email</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}