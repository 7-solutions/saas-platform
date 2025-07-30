'use client'

import { useState } from 'react'
import { Button } from '@saas-platform/ui'
import { X, Save, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react'
import type { MediaFile } from '@saas-platform/shared'

interface MediaEditModalProps {
  file: MediaFile
  onClose: () => void
  onUpdate: (fileId: string, updates: { alt_text?: string; filename?: string }) => Promise<MediaFile>
}

export function MediaEditModal({ file, onClose, onUpdate }: MediaEditModalProps) {
  const [altText, setAltText] = useState(file.alt_text || '')
  const [filename, setFilename] = useState(file.filename)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasChanges = altText !== (file.alt_text || '') || filename !== file.filename

  const handleUpdate = async () => {
    if (!hasChanges) {
      onClose()
      return
    }

    try {
      setIsUpdating(true)
      setError(null)

      const updates: { alt_text?: string; filename?: string } = {}
      
      if (altText !== (file.alt_text || '')) {
        updates.alt_text = altText
      }
      
      if (filename !== file.filename) {
        updates.filename = filename
      }

      await onUpdate(file.id, updates)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Update failed')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleClose = () => {
    if (!isUpdating) {
      onClose()
    }
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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Media</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isUpdating}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Image preview */}
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-shrink-0">
              <div className="w-full sm:w-64 h-48 bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={file.url}
                  alt={file.alt_text || file.original_name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* File details */}
            <div className="flex-1 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <ImageIcon className="h-5 w-5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">File Details</span>
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Original name:</dt>
                    <dd className="text-gray-900 font-medium">{file.original_name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Type:</dt>
                    <dd className="text-gray-900">{file.mime_type}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Size:</dt>
                    <dd className="text-gray-900">{formatFileSize(file.size)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Uploaded:</dt>
                    <dd className="text-gray-900">{formatDate(file.created_at)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">URL:</dt>
                    <dd className="text-gray-900 truncate max-w-48" title={file.url}>
                      {file.url}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* Edit form */}
          <div className="space-y-4">
            {/* Filename */}
            <div>
              <label htmlFor="filename" className="block text-sm font-medium text-gray-700 mb-2">
                Filename
              </label>
              <input
                id="filename"
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isUpdating}
                placeholder="Enter filename"
              />
              <p className="mt-1 text-xs text-gray-500">
                This will be used as the display name for the file
              </p>
            </div>

            {/* Alt text */}
            <div>
              <label htmlFor="altText" className="block text-sm font-medium text-gray-700 mb-2">
                Alt Text
                <span className="text-gray-500 font-normal ml-1">(Optional)</span>
              </label>
              <textarea
                id="altText"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Describe the image for accessibility and SEO"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={4}
                maxLength={200}
                disabled={isUpdating}
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">
                  Helps with accessibility and SEO. Describe what's in the image.
                </p>
                <p className="text-xs text-gray-500">
                  {altText.length}/200
                </p>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-red-400 mr-2" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpdate}
            disabled={!hasChanges || isUpdating}
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}