'use client'

import { useState } from 'react'
import { Search, Filter, X, ChevronDown } from 'lucide-react'
import { Button } from '@saas-platform/ui'

export interface MediaFiltersData {
  search: string
  mimeType: string
  tags: string[]
  folder: string
}

interface MediaFiltersProps {
  filters: MediaFiltersData
  onFiltersChange: (filters: MediaFiltersData) => void
  totalCount: number
}

const MIME_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'image/jpeg', label: 'JPEG Images' },
  { value: 'image/png', label: 'PNG Images' },
  { value: 'image/gif', label: 'GIF Images' },
  { value: 'image/webp', label: 'WebP Images' },
]

export function MediaFilters({ filters, onFiltersChange, totalCount }: MediaFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleSearchChange = (search: string) => {
    onFiltersChange({ ...filters, search })
  }

  const handleMimeTypeChange = (mimeType: string) => {
    onFiltersChange({ ...filters, mimeType })
  }

  const handleClearFilters = () => {
    onFiltersChange({
      search: '',
      mimeType: '',
      tags: [],
      folder: ''
    })
  }

  const hasActiveFilters = filters.search || filters.mimeType || filters.tags.length > 0 || filters.folder

  return (
    <div className="space-y-4">
      {/* Search and basic filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search files..."
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>

        {/* File type filter */}
        <div className="relative">
          <select
            value={filters.mimeType}
            onChange={(e) => handleMimeTypeChange(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md appearance-none bg-white"
          >
            {MIME_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
        </div>

        {/* Advanced filters toggle */}
        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2"
        >
          <Filter className="h-4 w-4" />
          <span>Filters</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">Advanced Filters</h3>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4 mr-1" />
                Clear all
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Folder filter - placeholder for future implementation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Folder
              </label>
              <select
                value={filters.folder}
                onChange={(e) => onFiltersChange({ ...filters, folder: e.target.value })}
                className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md appearance-none bg-white"
                disabled
              >
                <option value="">All Folders</option>
                <option value="images">Images</option>
                <option value="documents">Documents</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">Coming soon</p>
            </div>

            {/* Tags filter - placeholder for future implementation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags
              </label>
              <input
                type="text"
                placeholder="Enter tags..."
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled
              />
              <p className="mt-1 text-xs text-gray-500">Coming soon</p>
            </div>
          </div>
        </div>
      )}

      {/* Results summary */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div>
          {totalCount > 0 ? (
            <span>
              {hasActiveFilters ? 'Filtered: ' : ''}{totalCount} file{totalCount !== 1 ? 's' : ''}
            </span>
          ) : (
            <span>No files found</span>
          )}
        </div>

        {hasActiveFilters && (
          <div className="flex items-center space-x-2">
            <span>Active filters:</span>
            <div className="flex items-center space-x-1">
              {filters.search && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Search: "{filters.search}"
                  <button
                    onClick={() => handleSearchChange('')}
                    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </span>
              )}
              {filters.mimeType && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {MIME_TYPE_OPTIONS.find(opt => opt.value === filters.mimeType)?.label}
                  <button
                    onClick={() => handleMimeTypeChange('')}
                    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-green-200"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}