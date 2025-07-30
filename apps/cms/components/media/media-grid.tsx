'use client'

import { useState } from 'react'
import { 
  MoreVertical, 
  Edit, 
  Trash2, 
  Download, 
  Eye, 
  Copy,
  Check
} from 'lucide-react'
import { Button } from '@saas-platform/ui'
import type { MediaFile } from '@saas-platform/shared'

interface MediaGridProps {
  files: MediaFile[]
  selectedFiles: Set<string>
  onFileSelect: (fileId: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  onEdit: (file: MediaFile) => void
  onDelete: (file: MediaFile) => void
}

export function MediaGrid({ 
  files, 
  selectedFiles, 
  onFileSelect, 
  onSelectAll, 
  onEdit, 
  onDelete 
}: MediaGridProps) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const allSelected = files.length > 0 && files.every(f => selectedFiles.has(f.id))
  const someSelected = files.some(f => selectedFiles.has(f.id))

  const handleSelectAll = () => {
    onSelectAll(!allSelected)
  }

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(url)
      setTimeout(() => setCopiedUrl(null), 2000)
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }

  const handleDownload = (file: MediaFile) => {
    const link = document.createElement('a')
    link.href = file.url
    link.download = file.original_name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-4">
      {/* Select all header */}
      {files.length > 0 && (
        <div className="flex items-center justify-between py-2 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(input) => {
                if (input) input.indeterminate = someSelected && !allSelected
              }}
              onChange={handleSelectAll}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">
              {selectedFiles.size > 0 
                ? `${selectedFiles.size} of ${files.length} selected`
                : `${files.length} files`
              }
            </span>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {files.map((file) => (
          <MediaGridItem
            key={file.id}
            file={file}
            selected={selectedFiles.has(file.id)}
            onSelect={(selected) => onFileSelect(file.id, selected)}
            onEdit={() => onEdit(file)}
            onDelete={() => onDelete(file)}
            onCopyUrl={() => handleCopyUrl(file.url)}
            onDownload={() => handleDownload(file)}
            copiedUrl={copiedUrl}
            formatFileSize={formatFileSize}
            formatDate={formatDate}
          />
        ))}
      </div>
    </div>
  )
}

interface MediaGridItemProps {
  file: MediaFile
  selected: boolean
  onSelect: (selected: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onCopyUrl: () => void
  onDownload: () => void
  copiedUrl: string | null
  formatFileSize: (bytes: number) => string
  formatDate: (dateString: string) => string
}

function MediaGridItem({
  file,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onCopyUrl,
  onDownload,
  copiedUrl,
  formatFileSize,
  formatDate
}: MediaGridItemProps) {
  const [showActions, setShowActions] = useState(false)

  return (
    <div 
      className={`group relative bg-white border-2 rounded-lg overflow-hidden transition-all hover:shadow-md ${
        selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Selection checkbox */}
      <div className="absolute top-2 left-2 z-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded shadow-sm"
        />
      </div>

      {/* Actions menu */}
      {showActions && (
        <div className="absolute top-2 right-2 z-10">
          <div className="flex items-center space-x-1 bg-white rounded-md shadow-sm border border-gray-200 p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-6 w-6 p-0"
              title="Edit"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCopyUrl}
              className="h-6 w-6 p-0"
              title="Copy URL"
            >
              {copiedUrl === file.url ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDownload}
              className="h-6 w-6 p-0"
              title="Download"
            >
              <Download className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Image */}
      <div className="aspect-square bg-gray-100">
        <img
          src={file.url}
          alt={file.alt_text || file.original_name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* File info */}
      <div className="p-3 space-y-1">
        <h3 className="text-sm font-medium text-gray-900 truncate" title={file.original_name}>
          {file.original_name}
        </h3>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{formatFileSize(file.size)}</span>
          <span>{formatDate(file.created_at)}</span>
        </div>
        {file.alt_text && (
          <p className="text-xs text-gray-600 truncate" title={file.alt_text}>
            {file.alt_text}
          </p>
        )}
      </div>
    </div>
  )
}