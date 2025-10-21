'use client'

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-slate-400 text-sm font-medium mb-2">Total Orders</h3>
          <p className="text-3xl font-bold text-white">0</p>
        </div>
        
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-slate-400 text-sm font-medium mb-2">Pending Approval</h3>
          <p className="text-3xl font-bold text-yellow-500">0</p>
        </div>
        
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-slate-400 text-sm font-medium mb-2">Completed</h3>
          <p className="text-3xl font-bold text-green-500">0</p>
        </div>
      </div>

      <div className="mt-8 bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-xl font-semibold text-white mb-4">Welcome!</h2>
        <p className="text-slate-300">
          Your factory order management system is ready. Use the navigation menu to get started.
        </p>
      </div>
    </div>
  )
}