'use client';

// /app/dashboard/test-sms/page.tsx
// Simple SMS Test Page
// Created: November 2024

import { useState } from 'react';
import { Send, Loader2, CheckCircle, XCircle, Phone, MessageSquare } from 'lucide-react';

export default function TestSMSPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('Hello from BirdHaus! This is a test message. 🎉');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSendTest = async () => {
    if (!phoneNumber) {
      setResult({ success: false, message: 'Please enter a phone number' });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phoneNumber,
          message: message,
          invoiceNumber: 'TEST-001'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setResult({ 
          success: true, 
          message: `SMS sent! SID: ${data.data?.sid}` 
        });
      } else {
        setResult({ 
          success: false, 
          message: data.error || 'Failed to send SMS' 
        });
      }
    } catch (error: any) {
      setResult({ 
        success: false, 
        message: error.message || 'Error sending SMS' 
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">📱 SMS Test Page</h1>
      <p className="text-gray-600 mb-8">Test your Twilio SMS integration</p>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        {/* Phone Number Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Phone className="w-4 h-4 inline mr-2" />
            Phone Number
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1 (555) 123-4567"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Include country code (e.g., +1 for US). Trial accounts can only send to verified numbers.
          </p>
        </div>

        {/* Message Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MessageSquare className="w-4 h-4 inline mr-2" />
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            {message.length} characters • {Math.ceil(message.length / 160)} SMS segment(s)
          </p>
        </div>

        {/* Send Button */}
        <button
          onClick={handleSendTest}
          disabled={sending || !phoneNumber}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
        >
          {sending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Send Test SMS
            </>
          )}
        </button>

        {/* Result Display */}
        {result && (
          <div className={`p-4 rounded-lg flex items-start gap-3 ${
            result.success 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            {result.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                {result.success ? 'Success!' : 'Error'}
              </p>
              <p className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                {result.message}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Instructions Box */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="font-semibold text-amber-800 mb-2">⚠️ Trial Account Limitation</h3>
        <p className="text-sm text-amber-700">
          Twilio trial accounts can only send SMS to <strong>verified phone numbers</strong>.
          To verify a number:
        </p>
        <ol className="mt-2 text-sm text-amber-700 list-decimal ml-5 space-y-1">
          <li>Go to Twilio Console → Phone Numbers → Verified Caller IDs</li>
          <li>Click "Add a new Caller ID"</li>
          <li>Enter the phone number you want to test with</li>
          <li>Enter the verification code sent to that number</li>
        </ol>
      </div>
    </div>
  );
}
