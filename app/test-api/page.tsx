'use client';

export default function TestApiPage() {
  const testApi = async () => {
    console.log('Testing API...');
    
    try {
      const response = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: 'test-123',
          recipientEmail: 'test@example.com',
          ccEmails: []
        }),
      });
      
      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);
      alert('Check console for results');
    } catch (error) {
      console.error('Test failed:', error);
      alert('Test failed - check console');
    }
  };
  
  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">API Route Test</h1>
      <button 
        onClick={testApi}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Test API Route
      </button>
    </div>
  );
}