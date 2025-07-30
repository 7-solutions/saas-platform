'use client'

import { useForm, Controller, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { pageFormSchema, type PageFormData } from '../../lib/schemas'
import { RichTextEditor } from './rich-text-editor'
import { Button, Input, Label, Card } from '@saas-platform/ui'
import { useState, useEffect, useCallback } from 'react'
import { Save, Eye, Upload, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { Page, PageStatus } from '@saas-platform/shared'

interface PageEditorFormProps {
  page?: Page
  onSave: (data: PageFormData) => Promise<void>
  onPreview: (data: PageFormData) => void
  onImageUpload: (file: File) => Promise<string>
  isLoading?: boolean
  className?: string
}

export function PageEditorForm({
  page,
  onSave,
  onPreview,
  onImageUpload,
  isLoading = false,
  className = ''
}: PageEditorFormProps) {
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const form = useForm({
    resolver: zodResolver(pageFormSchema),
    defaultValues: {
      title: page?.title || '',
      slug: page?.slug || '',
      content: page?.content ? JSON.stringify(page.content) : '',
      meta: {
        title: page?.meta?.title || '',
        description: page?.meta?.description || '',
        keywords: []
      },
      status: page?.status === PageStatus.PUBLISHED ? 'published' as const : 'draft' as const
    }
  })

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty, isValid }
  } = form

  // Watch form values for auto-save
  const watchedValues = watch()

  // Generate slug from title
  const generateSlug = useCallback((title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }, [])

  // Auto-generate slug when title changes (only for new pages)
  useEffect(() => {
    if (!page && watchedValues.title) {
      const newSlug = generateSlug(watchedValues.title)
      setValue('slug', newSlug, { shouldValidate: true })
    }
  }, [watchedValues.title, page, generateSlug, setValue])

  // Auto-generate meta title when title changes
  useEffect(() => {
    if (watchedValues.title && !watchedValues.meta.title) {
      setValue('meta.title', watchedValues.title, { shouldValidate: true })
    }
  }, [watchedValues.title, watchedValues.meta.title, setValue])

  // Auto-save functionality
  useEffect(() => {
    if (!isDirty || !isValid) return

    const autoSaveTimer = setTimeout(async () => {
      try {
        setAutoSaveStatus('saving')
        
        // Store in localStorage as backup
        const autoSaveData = {
          ...watchedValues,
          id: page?.id,
          lastSaved: new Date()
        }
        localStorage.setItem(`page-draft-${page?.id || 'new'}`, JSON.stringify(autoSaveData))
        
        setAutoSaveStatus('saved')
        setLastSaved(new Date())
        
        // Clear saved status after 3 seconds
        setTimeout(() => {
          setAutoSaveStatus('idle')
        }, 3000)
      } catch (error) {
        console.error('Auto-save failed:', error)
        setAutoSaveStatus('error')
        setTimeout(() => {
          setAutoSaveStatus('idle')
        }, 3000)
      }
    }, 2000) // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(autoSaveTimer)
  }, [watchedValues, isDirty, isValid, page?.id])

  // Load draft from localStorage on mount
  useEffect(() => {
    if (!page) {
      const draftKey = 'page-draft-new'
      const savedDraft = localStorage.getItem(draftKey)
      if (savedDraft) {
        try {
          const draftData = JSON.parse(savedDraft)
          if (confirm('A draft was found. Would you like to restore it?')) {
            setValue('title', draftData.title)
            setValue('slug', draftData.slug)
            setValue('content', draftData.content)
            setValue('meta.title', draftData.meta.title)
            setValue('meta.description', draftData.meta.description)
            setValue('status', draftData.status)
            setLastSaved(new Date(draftData.lastSaved))
          } else {
            localStorage.removeItem(draftKey)
          }
        } catch (error) {
          console.error('Failed to restore draft:', error)
          localStorage.removeItem(draftKey)
        }
      }
    }
  }, [page, setValue])

  const onSubmit = async (data: PageFormData) => {
    try {
      await onSave(data)
      // Clear auto-save draft after successful save
      localStorage.removeItem(`page-draft-${page?.id || 'new'}`)
      setLastSaved(new Date())
    } catch (error) {
      console.error('Failed to save page:', error)
    }
  }

  const handlePreview = () => {
    const currentData = watchedValues as PageFormData
    onPreview(currentData)
  }

  const AutoSaveIndicator = () => {
    switch (autoSaveStatus) {
      case 'saving':
        return (
          <div className="flex items-center text-sm text-gray-500">
            <Clock className="h-4 w-4 mr-1 animate-spin" />
            Saving...
          </div>
        )
      case 'saved':
        return (
          <div className="flex items-center text-sm text-green-600">
            <CheckCircle className="h-4 w-4 mr-1" />
            Saved
          </div>
        )
      case 'error':
        return (
          <div className="flex items-center text-sm text-red-600">
            <AlertCircle className="h-4 w-4 mr-1" />
            Save failed
          </div>
        )
      default:
        return lastSaved ? (
          <div className="text-sm text-gray-500">
            Last saved: {lastSaved.toLocaleTimeString()}
          </div>
        ) : null
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={`space-y-6 ${className}`}>
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {page ? 'Edit Page' : 'Create New Page'}
          </h1>
          <AutoSaveIndicator />
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={handlePreview}
            disabled={!isValid}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          
          <Button
            type="submit"
            disabled={isLoading || !isDirty || !isValid}
          >
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save Page'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title */}
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder="Enter page title"
              className="mt-1"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          {/* Slug */}
          <div>
            <Label htmlFor="slug">URL Slug</Label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                /
              </span>
              <Input
                id="slug"
                {...register('slug')}
                placeholder="page-url-slug"
                className="rounded-l-none"
              />
            </div>
            {errors.slug && (
              <p className="mt-1 text-sm text-red-600">{errors.slug.message}</p>
            )}
          </div>

          {/* Content Editor */}
          <div>
            <Label>Content</Label>
            <div className="mt-1">
              <Controller
                name="content"
                control={control}
                render={({ field }) => (
                  <RichTextEditor
                    content={field.value}
                    onChange={field.onChange}
                    onImageUpload={onImageUpload}
                    placeholder="Start writing your page content..."
                  />
                )}
              />
            </div>
            {errors.content && (
              <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Page Settings */}
          <Card className="p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Page Settings</h3>
            
            <div className="space-y-4">
              {/* Status */}
              <div>
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  {...register('status')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>
          </Card>

          {/* SEO Settings */}
          <Card className="p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">SEO Settings</h3>
            
            <div className="space-y-4">
              {/* Meta Title */}
              <div>
                <Label htmlFor="meta.title">Meta Title</Label>
                <Input
                  id="meta.title"
                  {...register('meta.title')}
                  placeholder="SEO title for search engines"
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {watchedValues.meta?.title?.length || 0}/60 characters
                </p>
                {errors.meta?.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.meta.title.message}</p>
                )}
              </div>

              {/* Meta Description */}
              <div>
                <Label htmlFor="meta.description">Meta Description</Label>
                <textarea
                  id="meta.description"
                  {...register('meta.description')}
                  placeholder="Brief description for search engines"
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {watchedValues.meta?.description?.length || 0}/160 characters
                </p>
                {errors.meta?.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.meta.description.message}</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </form>
  )
}