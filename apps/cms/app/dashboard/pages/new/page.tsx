'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageEditorForm } from '../../../../components/editor/page-editor-form'
import { PagePreview } from '../../../../components/editor/page-preview'
import { MediaUpload } from '../../../../components/editor/media-upload'
import { PageFormData } from '../../../../lib/schemas'
import { useContentApi, useMediaApi, PageStatus } from '@saas-platform/shared'

export default function NewPagePage() {
  const router = useRouter()
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isMediaUploadOpen, setIsMediaUploadOpen] = useState(false)
  const [previewData, setPreviewData] = useState<PageFormData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Only initialize API clients on the client side
  const contentApi = typeof window !== 'undefined' ? useContentApi() : null
  const mediaApi = typeof window !== 'undefined' ? useMediaApi() : null

  const handleSave = async (data: PageFormData) => {
    if (!contentApi) return
    
    try {
      setIsLoading(true)
      
      // Convert form data to API format
      const pageData = {
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

      const result = await contentApi.createPage(pageData)
      
      if (result.error) {
        throw new Error(result.error.message)
      }

      // Redirect to edit page or pages list
      router.push(`/dashboard/pages/${result.data?.id}/edit`)
    } catch (error) {
      console.error('Failed to save page:', error)
      // In a real app, you'd show a toast notification here
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageEditorForm
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