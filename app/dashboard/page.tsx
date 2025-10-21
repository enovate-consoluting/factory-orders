'use client'

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-gray-500 text-sm font-medium mb-2">Total Orders</h3>
          <p className="text-3xl font-bold text-gray-900">0</p>
        </div>
        
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-gray-500 text-sm font-medium mb-2">Pending Approval</h3>
          <p className="text-3xl font-bold text-yellow-600">0</p>
        </div>
        
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-gray-500 text-sm font-medium mb-2">Completed</h3>
          <p className="text-3xl font-bold text-green-600">0</p>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Welcome!</h2>
        <p className="text-gray-600">
          Your factory order management system is ready. Use the navigation menu to get started.
        </p>
      </div>
    </div>
  )
}