'use client'

import { useState } from 'react'
import { Button } from '@saas-platform/ui'
import { X, Trash2, Loader2, AlertTriangle, Image as ImageIcon } from 'lucide-react'
import type { MediaFile } from '@saas-platform/shared'

interface MediaDeleteModalProps {
  files: MediaFile[]
  onClose: () => void
  onDelete: (fileIds: string[]) => Promise<void>
}

export function MediaDeleteModal({ files, onClose, onDelete }: MediaDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSingle = files.length === 1
  const fileIds = files.map(f => f.id)

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      setError(null)

      await onDelete(fileIds)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Delete failed')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleClose = () => {
    if (!isDeleting) {
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

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              Delete {isSingle ? 'File' : 'Files'}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isDeleting}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="text-sm text-gray-600">
            {isSingle ? (
              <p>
                Are you sure you want to delete this file? This action cannot be undone.
              </p>
            ) : (
              <p>
                Are you sure you want to delete these {files.length} files? This action cannot be undone.
              </p>
            )}
          </div>

          {/* File list */}
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
            {files.map((file, index) => (
              <div 
                key={file.id} 
                className={`flex items-center space-x-3 p-3 ${
                  index !== files.length - 1 ? 'border-b border-gray-200' : ''
                }`}
              >
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
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.original_name}
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <span>{formatFileSize(file.size)}</span>
                    <span>•</span>
                    <span>{file.mime_type}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Warning about usage */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <div className="flex items-start">
              <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Warning</p>
                <p className="mt-1">
                  {isSingle 
                    ? 'If this file is used in any pages or content, those references will be broken.'
                    : 'If any of these files are used in pages or content, those references will be broken.'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-red-400 mr-2" />
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
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete {isSingle ? 'File' : `${files.length} Files`}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}