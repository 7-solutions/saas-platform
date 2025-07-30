'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageEditorForm } from '../../../../../components/editor/page-editor-form'
import { PagePreview } from '../../../../../components/editor/page-preview'
import { MediaUpload } from '../../../../../components/editor/media-upload'
import { PageFormData } from '../../../../../lib/schemas'
import { useContentApi, useMediaApi, Page, PageStatus } from '@saas-platform/shared'
import { Loader2 } from 'lucide-react'

interface EditPagePageProps {
  params: {
    id: string
  }
}

export default function EditPagePage({ params }: EditPagePageProps) {
  const router = useRouter()
  const [page, setPage] = useState<Page | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isMediaUploadOpen, setIsMediaUploadOpen] = useState(false)
  const [previewData, setPreviewData] = useState<PageFormData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Only initialize API clients on the client side
  const contentApi = typeof window !== 'undefined' ? useContentApi() : null
  const mediaApi = typeof window !== 'undefined' ? useMediaApi() : null

  // Load page data
  useEffect(() => {
    if (!contentApi) return
    
    const loadPage = async () => {
      try {
        setIsPageLoading(true)
        const result = await contentApi.getPage({ id: params.id })
        
        if (result.error) {
          throw new Error(result.error.message)
        }

        if (result.data) {
          setPage(result.data)
        } else {
          throw new Error('Page not found')
        }
      } catch (error: any) {
        console.error('Failed to load page:', error)
        setError(error.message || 'Failed to load page')
      } finally {
        setIsPageLoading(false)
      }
    }

    loadPage()
  }, [params.id, contentApi])

  const handleSave = async (data: PageFormData) => {
    if (!page || !contentApi) return

    try {
      setIsLoading(true)
      
      // Convert form data to API format
      const pageData = {
        id: page.id,
        title: data.title,
        slug: data.slug,
        content: {
          blocks: [
            {
              type: 'html',
              data: { content: data.content }
            }
          ]
        },
        meta: {
          title: data.meta.title,
          description: data.meta.description,
          keywords: data.meta.keywords || []
        },
        status: data.status === 'published' ? PageStatus.PUBLISHED : PageStatus.DRAFT
      }

      const result = await contentApi.updatePage(pageData)
      
      if (result.error) {
        throw new Error(result.error.message)
      }

      // Update local page state
      if (result.data) {
        setPage(result.data)
      }

      // Show success message (in a real app, you'd use a toast)
      alert('Page saved successfully!')
    } catch (error) {
      console.error('Failed to save page:', error)
      alert('Failed to save page. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePreview = (data: PageFormData) => {
    setPreviewData(data)
    setIsPreviewOpen(true)
  }

  const handleImageUpload = async (file: File, altText?: string): Promise<string> => {
    if (!mediaApi) throw new Error('Media API not available')
    
    try {
      // Convert file to Uint8Array for the API
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      const result = await mediaApi.uploadFile({
        content: uint8Array,
        filename: file.name,
        mime_type: file.type,
        alt_text: altText
      })

      if (result.error) {
        throw new Error(result.error.message)
      }

      return result.data?.url || ''
    } catch (error) {
      console.error('Failed to upload image:', error)
      throw error
    }
  }

  if (isPageLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Loading page...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard/pages')}
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back to Pages
          </button>
        </div>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Page Not Found</h1>
          <p className="text-gray-600 mb-4">The page you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/dashboard/pages')}
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back to Pages
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageEditorForm
        page={page}
        onSave={handleSave}
        onPreview={handlePreview}
        onImageUpload={handleImageUpload}
        isLoading={isLoading}
      />

      {/* Preview Modal */}
      {previewData && (
        <PagePreview
          data={previewData}
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}

      {/* Media Upload Modal */}
      <MediaUpload
        isOpen={isMediaUploadOpen}
        onClose={() => setIsMediaUploadOpen(false)}
        onUpload={handleImageUpload}
      />
    </div>
  )
}