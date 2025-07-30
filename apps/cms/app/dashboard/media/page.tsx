'use client'

import { useState } from 'react'
import { MediaLibrary } from '../../../components/media/media-library'

export default function MediaPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your images and media files
          </p>
        </div>
      </div>
      
      <MediaLibrary />
    </div>
  )
}