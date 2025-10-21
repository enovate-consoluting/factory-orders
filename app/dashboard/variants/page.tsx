'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type VariantType = {
  id: string
  name: string
  created_at: string
}

type VariantOption = {
  id: string
  type_id: string
  value: string
  created_at: string
}

export default function VariantsPage() {
  const [variantTypes, setVariantTypes] = useState<VariantType[]>([])
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([])
  const [loading, setLoading] = useState(true)
  
  // New variant type form
  const [newTypeName, setNewTypeName] = useState('')
  const [showTypeForm, setShowTypeForm] = useState(false)
  
  // New variant option form
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [newOptionValue, setNewOptionValue] = useState('')
  const [showOptionForm, setShowOptionForm] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    
    // Load variant types
    const { data: types } = await supabase
      .from('variant_types')
      .select('*')
      .order('name')
    
    // Load variant options
    const { data: options } = await supabase
      .from('variant_options')
      .select('*')
      .order('value')
    
    setVariantTypes(types || [])
    setVariantOptions(options || [])
    setLoading(false)
  }

  const createVariantType = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newTypeName.trim()) return
    
    const { error } = await supabase
      .from('variant_types')
      .insert([{ name: newTypeName.trim() }])
    
    if (!error) {
      setNewTypeName('')
      setShowTypeForm(false)
      loadData()
    }
  }

  const createVariantOption = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedTypeId || !newOptionValue.trim()) return
    
    const { error } = await supabase
      .from('variant_options')
      .insert([{ 
        type_id: selectedTypeId, 
        value: newOptionValue.trim() 
      }])
    
    if (!error) {
      setNewOptionValue('')
      setShowOptionForm(false)
      loadData()
    }
  }

  const deleteVariantType = async (id: string) => {
    if (!confirm('Delete this variant type? This will also delete all its options.')) return
    
    await supabase
      .from('variant_types')
      .delete()
      .eq('id', id)
    
    loadData()
  }

  const deleteVariantOption = async (id: string) => {
    if (!confirm('Delete this variant option?')) return
    
    await supabase
      .from('variant_options')
      .delete()
      .eq('id', id)
    
    loadData()
  }

  const getOptionsForType = (typeId: string) => {
    return variantOptions.filter(opt => opt.type_id === typeId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading variants...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Variant Configuration</h1>
        <button
          onClick={() => setShowTypeForm(!showTypeForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-sm"
        >
          {showTypeForm ? 'Cancel' : '+ New Variant Type'}
        </button>
      </div>

      {/* New Variant Type Form */}
      {showTypeForm && (
        <div className="mb-6 bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Variant Type</h2>
          <form onSubmit={createVariantType} className="flex gap-4">
            <input
              type="text"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="e.g., Size, Color, Fabric"
              className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <button
              type="submit"
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition shadow-sm"
            >
              Create
            </button>
          </form>
        </div>
      )}

      {/* Variant Types List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {variantTypes.map((type) => (
          <div key={type.id} className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold text-gray-900">{type.name}</h3>
              <button
                onClick={() => deleteVariantType(type.id)}
                className="text-red-500 hover:text-red-600 text-sm font-medium"
              >
                Delete
              </button>
            </div>

            {/* Options for this type */}
            <div className="space-y-2 mb-4">
              {getOptionsForType(type.id).map((option) => (
                <div
                  key={option.id}
                  className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded border border-gray-200"
                >
                  <span className="text-gray-700">{option.value}</span>
                  <button
                    onClick={() => deleteVariantOption(option.id)}
                    className="text-red-500 hover:text-red-600 text-xs font-medium"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Add option button */}
            <button
              onClick={() => {
                setSelectedTypeId(type.id)
                setShowOptionForm(true)
              }}
              className="w-full px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-sm transition font-medium"
            >
              + Add Option
            </button>
          </div>
        ))}
      </div>

      {/* New Variant Option Modal */}
      {showOptionForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full border border-gray-200 shadow-xl">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Add Variant Option</h2>
            <form onSubmit={createVariantOption} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Variant Type
                </label>
                <select
                  value={selectedTypeId}
                  onChange={(e) => setSelectedTypeId(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select type...</option>
                  {variantTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Option Value
                </label>
                <input
                  type="text"
                  value={newOptionValue}
                  onChange={(e) => setNewOptionValue(e.target.value)}
                  placeholder="e.g., Large, Black, Cotton"
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionForm(false)
                    setNewOptionValue('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition shadow-sm"
                >
                  Add Option
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {variantTypes.length === 0 && (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          <p className="mt-4 text-gray-600">No variant types yet. Create one to get started!</p>
        </div>
      )}
    </div>
  )
}