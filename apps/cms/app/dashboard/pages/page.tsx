'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Button, 
  Card, 
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Pagination
} from '@saas-platform/ui'
import { 
  Plus, 
  FileText, 
  Eye, 
  Edit, 
  Trash2, 
  Search,
  Filter,
  MoreHorizontal,
  Clock,
  CheckCircle,
  Copy,
  Globe,
  Archive,
  ChevronDown,
  AlertTriangle
} from 'lucide-react'

// Mock data - in a real app this would come from the API
const mockPages = [
  {
    id: '1',
    title: 'Homepage',
    slug: 'home',
    status: 'published' as const,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-20T14:30:00Z'
  },
  {
    id: '2',
    title: 'About Us',
    slug: 'about',
    status: 'published' as const,
    created_at: '2024-01-16T09:00:00Z',
    updated_at: '2024-01-18T11:15:00Z'
  },
  {
    id: '3',
    title: 'Services',
    slug: 'services',
    status: 'draft' as const,
    created_at: '2024-01-17T16:00:00Z',
    updated_at: '2024-01-17T16:45:00Z'
  },
  {
    id: '4',
    title: 'Contact',
    slug: 'contact',
    status: 'published' as const,
    created_at: '2024-01-18T12:00:00Z',
    updated_at: '2024-01-19T09:30:00Z'
  },
  {
    id: '5',
    title: 'Privacy Policy',
    slug: 'privacy',
    status: 'draft' as const,
    created_at: '2024-01-19T14:00:00Z',
    updated_at: '2024-01-19T14:30:00Z'
  },
  {
    id: '6',
    title: 'Terms of Service',
    slug: 'terms',
    status: 'published' as const,
    created_at: '2024-01-20T10:00:00Z',
    updated_at: '2024-01-20T11:00:00Z'
  }
]

const ITEMS_PER_PAGE = 5

export default function PagesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [selectedPages, setSelectedPages] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pageToDelete, setPageToDelete] = useState<string | null>(null)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Filter and paginate pages
  const filteredPages = mockPages.filter(page => {
    const matchesSearch = page.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         page.slug.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || page.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalPages = Math.ceil(filteredPages.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedPages = filteredPages.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

  // Clear selection when filters change
  useEffect(() => {
    setSelectedPages([])
  }, [searchTerm, statusFilter, currentPage])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: 'published' | 'draft') => {
    if (status === 'published') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Published
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <Clock className="h-3 w-3 mr-1" />
        Draft
      </span>
    )
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPages(paginatedPages.map(page => page.id))
    } else {
      setSelectedPages([])
    }
  }

  const handleSelectPage = (pageId: string, checked: boolean) => {
    if (checked) {
      setSelectedPages(prev => [...prev, pageId])
    } else {
      setSelectedPages(prev => prev.filter(id => id !== pageId))
    }
  }

  const handleStatusChange = async (pageId: string, newStatus: 'published' | 'draft') => {
    setIsLoading(true)
    try {
      // In a real app, this would call the API
      console.log(`Changing page ${pageId} status to ${newStatus}`)
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      console.error('Failed to update page status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkStatusChange = async (newStatus: 'published' | 'draft') => {
    setIsLoading(true)
    try {
      // In a real app, this would call the API for each selected page
      console.log(`Changing ${selectedPages.length} pages status to ${newStatus}`)
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      setSelectedPages([])
    } catch (error) {
      console.error('Failed to update pages status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeletePage = async (pageId: string) => {
    setIsLoading(true)
    try {
      // In a real app, this would call the API
      console.log(`Deleting page ${pageId}`)
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setDeleteDialogOpen(false)
      setPageToDelete(null)
    } catch (error) {
      console.error('Failed to delete page:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    setIsLoading(true)
    try {
      // In a real app, this would call the API for each selected page
      console.log(`Deleting ${selectedPages.length} pages`)
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      setSelectedPages([])
      setBulkDeleteDialogOpen(false)
    } catch (error) {
      console.error('Failed to delete pages:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDuplicatePage = async (pageId: string) => {
    setIsLoading(true)
    try {
      // In a real app, this would call the API
      console.log(`Duplicating page ${pageId}`)
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      console.error('Failed to duplicate page:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const isAllSelected = paginatedPages.length > 0 && selectedPages.length === paginatedPages.length
  const isIndeterminate = selectedPages.length > 0 && selectedPages.length < paginatedPages.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Pages</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your website pages and content
          </p>
        </div>
        <Link href="/dashboard/pages/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Page
          </Button>
        </Link>
      </div>

      {/* Filters and Bulk Actions */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search pages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Status filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'published' | 'draft')}
              className="border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          {/* Bulk Actions */}
          {selectedPages.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {selectedPages.length} selected
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Bulk Actions
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleBulkStatusChange('published')}>
                    <Globe className="h-4 w-4 mr-2" />
                    Publish Selected
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusChange('draft')}>
                    <Archive className="h-4 w-4 mr-2" />
                    Unpublish Selected
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setBulkDeleteDialogOpen(true)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </Card>

      {/* Pages list */}
      <Card>
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <Checkbox
                    checked={isAllSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className={isIndeterminate ? 'indeterminate' : ''}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Page
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedPages.length > 0 ? (
                paginatedPages.map((page) => (
                  <tr key={page.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Checkbox
                        checked={selectedPages.includes(page.id)}
                        onChange={(e) => handleSelectPage(page.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {page.title}
                          </div>
                          <div className="text-sm text-gray-500">
                            /{page.slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(page.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(page.updated_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(page.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Link href={`/dashboard/pages/${page.id}/edit`}>
                          <Button
                            variant="outline"
                            size="sm"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              title="More actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {page.status === 'draft' ? (
                              <DropdownMenuItem onClick={() => handleStatusChange(page.id, 'published')}>
                                <Globe className="h-4 w-4 mr-2" />
                                Publish
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleStatusChange(page.id, 'draft')}>
                                <Archive className="h-4 w-4 mr-2" />
                                Unpublish
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleDuplicatePage(page.id)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => {
                                setPageToDelete(page.id)
                                setDeleteDialogOpen(true)
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-sm font-medium text-gray-900 mb-1">No pages found</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        {searchTerm || statusFilter !== 'all' 
                          ? 'Try adjusting your search or filter criteria.'
                          : 'Get started by creating your first page.'
                        }
                      </p>
                      {!searchTerm && statusFilter === 'all' && (
                        <Link href="/dashboard/pages/new">
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Page
                          </Button>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filteredPages.length)} of {filteredPages.length} results
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Pages</p>
              <p className="text-2xl font-semibold text-gray-900">{mockPages.length}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Published</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mockPages.filter(p => p.status === 'published').length}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Drafts</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mockPages.filter(p => p.status === 'draft').length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              Delete Page
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this page? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => pageToDelete && handleDeletePage(pageToDelete)}
              disabled={isLoading}
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              Delete Multiple Pages
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedPages.length} selected pages? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isLoading}
            >
              {isLoading ? 'Deleting...' : `Delete ${selectedPages.length} Pages`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}