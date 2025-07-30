'use client'

import { useState } from 'react'
import { PageFormData } from '../../lib/schemas'
import { Button } from '@saas-platform/ui'
import { X, Monitor, Smartphone, Tablet } from 'lucide-react'

interface PagePreviewProps {
  data: PageFormData
  onClose: () => void
  isOpen: boolean
}

export function PagePreview({ data, onClose, isOpen }: PagePreviewProps) {
  const [viewMode, setViewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')

  if (!isOpen) return null

  const getPreviewWidth = () => {
    switch (viewMode) {
      case 'mobile':
        return 'max-w-sm'
      case 'tablet':
        return 'max-w-2xl'
      default:
        return 'max-w-full'
    }
  }

  const getPreviewHeight = () => {
    switch (viewMode) {
      case 'mobile':
        return 'h-[667px]'
      case 'tablet':
        return 'h-[1024px]'
      default:
        return 'h-full'
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full h-full max-w-7xl max-h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-900">Preview: {data.title}</h2>
            
            {/* View mode selector */}
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant={viewMode === 'desktop' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('desktop')}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={viewMode === 'tablet' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('tablet')}
              >
                <Tablet className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={viewMode === 'mobile' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('mobile')}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <div className={`mx-auto bg-white shadow-lg rounded-lg overflow-hidden ${getPreviewWidth()} ${getPreviewHeight()}`}>
            {/* Simulated browser header */}
            <div className="bg-gray-200 px-4 py-2 flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              </div>
              <div className="flex-1 bg-white rounded px-3 py-1 text-sm text-gray-600">
                https://yoursite.com/{data.slug}
              </div>
            </div>

            {/* Page content */}
            <div className="p-6 overflow-auto">
              {/* Page title */}
              <h1 className="text-3xl font-bold text-gray-900 mb-6">
                {data.title}
              </h1>

              {/* Page content */}
              <div 
                className="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: data.content }}
              />

              {/* SEO preview at bottom */}
              <div className="mt-12 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 mb-2">SEO Preview</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-blue-600 text-lg hover:underline cursor-pointer">
                    {data.meta.title}
                  </div>
                  <div className="text-green-700 text-sm mt-1">
                    https://yoursite.com/{data.slug}
                  </div>
                  <div className="text-gray-600 text-sm mt-2">
                    {data.meta.description}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              Status: <span className={`font-medium ${data.status === 'published' ? 'text-green-600' : 'text-yellow-600'}`}>
                {data.status === 'published' ? 'Published' : 'Draft'}
              </span>
            </div>
            <div>
              Viewing in {viewMode} mode
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}