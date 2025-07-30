'use client'

import { useState } from 'react'
import { 
  Edit, 
  Trash2, 
  Download, 
  Copy,
  Check,
  Image as ImageIcon
} from 'lucide-react'
import { Button } from '@saas-platform/ui'
import type { MediaFile } from '@saas-platform/shared'

interface MediaListProps {
  files: MediaFile[]
  selectedFiles: Set<string>
  onFileSelect: (fileId: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  onEdit: (file: MediaFile) => void
  onDelete: (file: MediaFile) => void
}

export function MediaList({ 
  files, 
  selectedFiles, 
  onFileSelect, 
  onSelectAll, 
  onEdit, 
  onDelete 
}: MediaListProps) {
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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
        <div className="flex items-center">
          <div className="flex items-center space-x-3 flex-1">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(input) => {
                if (input) input.indeterminate = someSelected && !allSelected
              }}
              onChange={handleSelectAll}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-700">
              {selectedFiles.size > 0 
                ? `${selectedFiles.size} of ${files.length} selected`
                : 'Name'
              }
            </span>
          </div>
          <div className="hidden sm:flex items-center space-x-8 text-sm font-medium text-gray-700">
            <span className="w-20">Size</span>
            <span className="w-32">Modified</span>
            <span className="w-20">Actions</span>
          </div>
        </div>
      </div>

      {/* File list */}
      <div className="divide-y divide-gray-200">
        {files.map((file) => (
          <MediaListItem
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

interface MediaListItemProps {
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

function MediaListItem({
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
}: MediaListItemProps) {
  return (
    <div className={`px-6 py-4 hover:bg-gray-50 ${selected ? 'bg-blue-50' : ''}`}>
      <div className="flex items-center">
        {/* Selection and thumbnail */}
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          
          <div className="flex-shrink-0">
            <div className="h-10 w-10 bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={file.url}
                alt={file.alt_text || file.original_name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium text-gray-900 truncate">
                {file.original_name}
              </p>
              {file.alt_text && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                  Alt text
                </span>
              )}
            </div>
            {file.alt_text && (
              <p className="text-sm text-gray-500 truncate mt-1" title={file.alt_text}>
                {file.alt_text}
              </p>
            )}
            <div className="flex items-center space-x-4 mt-1 sm:hidden">
              <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
              <span className="text-xs text-gray-500">{formatDate(file.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Desktop info and actions */}
        <div className="hidden sm:flex items-center space-x-8">
          <div className="w-20 text-sm text-gray-500">
            {formatFileSize(file.size)}
          </div>
          
          <div className="w-32 text-sm text-gray-500">
            {formatDate(file.created_at)}
          </div>

          <div className="w-20 flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-8 w-8 p-0"
              title="Edit"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCopyUrl}
              className="h-8 w-8 p-0"
              title="Copy URL"
            >
              {copiedUrl === file.url ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDownload}
              className="h-8 w-8 p-0"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile actions */}
        <div className="flex items-center space-x-1 sm:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-8 w-8 p-0 text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}