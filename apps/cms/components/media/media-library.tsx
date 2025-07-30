'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { 
  Upload, 
  Search, 
  Grid, 
  List, 
  Filter,
  Plus,
  X,
  Loader2,
  AlertCircle,
  Trash2,
  Edit,
  Eye,
  Download,
  FolderPlus,
  Tag
} from 'lucide-react'
import { Button } from '@saas-platform/ui'
import { useMediaApi } from '@saas-platform/shared'
import type { MediaFile, ListFilesResponse } from '@saas-platform/shared'
import { MediaUploadModal } from './media-upload-modal'
import { MediaGrid } from './media-grid'
import { MediaList } from './media-list'
import { MediaEditModal } from './media-edit-modal'
import { MediaDeleteModal } from './media-delete-modal'
import { MediaFilters, type MediaFiltersData } from './media-filters'

export type ViewMode = 'grid' | 'list'

export interface MediaLibraryFilters {
  search: string
  mimeType: string
  tags: string[]
  folder: string
}

export function MediaLibrary() {
  // Only render on client side to avoid SSR issues
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  if (!isClient) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }
  
  return <MediaLibraryClient />
}

function MediaLibraryClient() {
  const media = useMediaApi()
  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [editingFile, setEditingFile] = useState<MediaFile | null>(null)
  const [deletingFiles, setDeletingFiles] = useState<MediaFile[]>([])
  const [filters, setFilters] = useState<MediaFiltersData>({
    search: '',
    mimeType: '',
    tags: [],
    folder: ''
  })
  const [pagination, setPagination] = useState({
    pageToken: '',
    hasMore: false,
    totalCount: 0
  })

  // Load files
  const loadFiles = useCallback(async (reset = false) => {
    try {
      setLoading(true)
      setError(null)

      const request = {
        page_size: 50,
        page_token: reset ? '' : pagination.pageToken,
        search: filters.search || undefined,
        mime_type_filter: filters.mimeType || undefined
      }

      const response = await media.listFiles(request)
      
      if (response.error) {
        throw new Error(response.error.message)
      }

      const data = response.data as ListFilesResponse
      
      if (reset) {
        setFiles(data.files)
      } else {
        setFiles(prev => [...prev, ...data.files])
      }

      setPagination({
        pageToken: data.next_page_token,
        hasMore: !!data.next_page_token,
        totalCount: data.total_count
      })
    } catch (err: any) {
      setError(err.message || 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [media, filters, pagination.pageToken])

  // Initial load
  useEffect(() => {
    loadFiles(true)
  }, [filters, loadFiles])

  // Handle file upload
  const handleUpload = async (file: File, altText?: string) => {
    try {
      const response = await media.uploadFile(file, altText)
      
      if (response.error) {
        throw new Error(response.error.message)
      }

      // Add new file to the beginning of the list
      setFiles(prev => [response.data!, ...prev])
      setPagination(prev => ({ ...prev, totalCount: prev.totalCount + 1 }))
      
      return response.data!.url
    } catch (err: any) {
      throw new Error(err.message || 'Upload failed')
    }
  }

  // Handle file update
  const handleUpdate = async (fileId: string, updates: { alt_text?: string; filename?: string }) => {
    try {
      const response = await media.updateFile({ id: fileId, ...updates })
      
      if (response.error) {
        throw new Error(response.error.message)
      }

      // Update file in the list
      setFiles(prev => prev.map(f => f.id === fileId ? response.data! : f))
      
      return response.data!
    } catch (err: any) {
      throw new Error(err.message || 'Update failed')
    }
  }

  // Handle file deletion
  const handleDelete = async (fileIds: string[]) => {
    try {
      // Delete files one by one
      for (const fileId of fileIds) {
        const response = await media.deleteFile({ id: fileId })
        
        if (response.error) {
          throw new Error(response.error.message)
        }
      }

      // Remove files from the list
      setFiles(prev => prev.filter(f => !fileIds.includes(f.id)))
      setSelectedFiles(new Set())
      setPagination(prev => ({ ...prev, totalCount: prev.totalCount - fileIds.length }))
    } catch (err: any) {
      throw new Error(err.message || 'Delete failed')
    }
  }

  // Handle file selection
  const handleFileSelect = (fileId: string, selected: boolean) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(fileId)
      } else {
        newSet.delete(fileId)
      }
      return newSet
    })
  }

  // Handle select all
  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedFiles(new Set(files.map(f => f.id)))
    } else {
      setSelectedFiles(new Set())
    }
  }

  // Handle bulk delete
  const handleBulkDelete = () => {
    const filesToDelete = files.filter(f => selectedFiles.has(f.id))
    setDeletingFiles(filesToDelete)
  }

  // Drag and drop for bulk upload
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 1) {
      setShowUploadModal(true)
    } else {
      // Handle multiple files - could implement bulk upload
      console.log('Multiple files dropped:', acceptedFiles)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    noClick: true,
    noKeyboard: true
  })

  return (
    <div className="space-y-6" {...getRootProps()}>
      <input {...getInputProps()} />
      
      {/* Drag overlay */}
      {isDragActive && (
        <div className="fixed inset-0 z-50 bg-blue-500 bg-opacity-20 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-8 text-center">
            <Upload className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <p className="text-xl font-semibold text-gray-900">Drop files to upload</p>
            <p className="text-gray-500">Release to start uploading</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Upload Files
          </Button>
          
          {selectedFiles.size > 0 && (
            <Button
              variant="outline"
              onClick={handleBulkDelete}
              className="flex items-center gap-2 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedFiles.size})
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center border border-gray-300 rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <MediaFilters
        filters={filters}
        onFiltersChange={setFilters}
        totalCount={pagination.totalCount}
      />

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && files.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && files.length === 0 && !error && (
        <div className="text-center py-12">
          <Upload className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
          <p className="text-gray-500 mb-4">
            {filters.search || filters.mimeType 
              ? 'Try adjusting your filters or search terms'
              : 'Get started by uploading your first file'
            }
          </p>
          <Button onClick={() => setShowUploadModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
        </div>
      )}

      {/* Files display */}
      {files.length > 0 && (
        <>
          {viewMode === 'grid' ? (
            <MediaGrid
              files={files}
              selectedFiles={selectedFiles}
              onFileSelect={handleFileSelect}
              onSelectAll={handleSelectAll}
              onEdit={setEditingFile}
              onDelete={(file) => setDeletingFiles([file])}
            />
          ) : (
            <MediaList
              files={files}
              selectedFiles={selectedFiles}
              onFileSelect={handleFileSelect}
              onSelectAll={handleSelectAll}
              onEdit={setEditingFile}
              onDelete={(file) => setDeletingFiles([file])}
            />
          )}

          {/* Load more */}
          {pagination.hasMore && (
            <div className="text-center">
              <Button
                variant="outline"
                onClick={() => loadFiles(false)}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <MediaUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUpload}
      />

      {editingFile && (
        <MediaEditModal
          file={editingFile}
          onClose={() => setEditingFile(null)}
          onUpdate={handleUpdate}
        />
      )}

      {deletingFiles.length > 0 && (
        <MediaDeleteModal
          files={deletingFiles}
          onClose={() => setDeletingFiles([])}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}