import { z } from 'zod'
import { PageStatus } from '@saas-platform/shared'

// Page form validation schema
export const pageFormSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters'),
  
  slug: z.string()
    .min(1, 'Slug is required')
    .max(100, 'Slug must be less than 100 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .refine(slug => !slug.startsWith('-') && !slug.endsWith('-'), 'Slug cannot start or end with a hyphen'),
  
  content: z.string()
    .min(1, 'Content is required'),
  
  meta: z.object({
    title: z.string()
      .min(1, 'Meta title is required')
      .max(60, 'Meta title should be less than 60 characters for SEO'),
    
    description: z.string()
      .min(1, 'Meta description is required')
      .max(160, 'Meta description should be less than 160 characters for SEO'),
    
    keywords: z.array(z.string()).default([])
  }),
  
  status: z.enum(['draft', 'published'] as const)
    .default('draft')
})

export type PageFormData = z.infer<typeof pageFormSchema>

// Media upload validation schema
export const mediaUploadSchema = z.object({
  file: z.instanceof(File)
    .refine(file => file.size <= 10 * 1024 * 1024, 'File size must be less than 10MB')
    .refine(
      file => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type),
      'Only JPEG, PNG, GIF, and WebP images are allowed'
    ),
  
  alt_text: z.string()
    .max(200, 'Alt text must be less than 200 characters')
    .optional()
})

export type MediaUploadData = z.infer<typeof mediaUploadSchema>

// Auto-save data schema
export const autoSaveSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  slug: z.string(),
  content: z.string(),
  meta: z.object({
    title: z.string(),
    description: z.string(),
    keywords: z.array(z.string()).optional().default([])
  }),
  status: z.enum(['draft', 'published'] as const),
  lastSaved: z.date()
})

export type AutoSaveData = z.infer<typeof autoSaveSchema>