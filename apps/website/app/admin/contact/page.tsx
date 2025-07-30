'use client';

import { useState } from 'react';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { Button, Card, Input } from '@saas-platform/ui';
import { 
  useContactSubmissions, 
  useMarkContactSubmissionAsRead, 
  useDeleteContactSubmission,
  ContactStatus 
} from '@saas-platform/shared';

export default function AdminContactPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContactStatus | ''>('');
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);

  const { data: submissionsResponse, isLoading, error } = useContactSubmissions({
    search: search || undefined,
    status: statusFilter || undefined,
    page_size: 50,
  });

  const markAsRead = useMarkContactSubmissionAsRead();
  const deleteSubmission = useDeleteContactSubmission();

  const submissions = submissionsResponse?.data?.submissions || [];

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead.mutateAsync(id);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this submission?')) {
      try {
        await deleteSubmission.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete submission:', error);
      }
    }
  };

  const getStatusBadge = (status: ContactStatus) => {
    const statusConfig = {
      [ContactStatus.NEW]: { color: 'bg-blue-100 text-blue-800', label: 'New' },
      [ContactStatus.READ]: { color: 'bg-gray-100 text-gray-800', label: 'Read' },
      [ContactStatus.REPLIED]: { color: 'bg-green-100 text-green-800', label: 'Replied' },
      [ContactStatus.SPAM]: { color: 'bg-red-100 text-red-800', label: 'Spam' },
      [ContactStatus.UNSPECIFIED]: { color: 'bg-gray-100 text-gray-800', label: 'Unknown' },
    };

    const config = statusConfig[status] || statusConfig[ContactStatus.UNSPECIFIED];
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (error) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">Failed to load contact submissions</div>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contact Submissions</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage and respond to contact form submissions
          </p>
        </div>

        {/* Filters */}
        <Card className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700">
                Search
              </label>
              <Input
                id="search"
                type="text"
                placeholder="Search by name, email, or message..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                id="status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ContactStatus | '')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
              >
                <option value="">All Statuses</option>
                <option value={ContactStatus.NEW}>New</option>
                <option value={ContactStatus.READ}>Read</option>
                <option value={ContactStatus.REPLIED}>Replied</option>
                <option value={ContactStatus.SPAM}>Spam</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Submissions List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Loading submissions...</div>
          </div>
        ) : submissions.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-gray-500 mb-4">No contact submissions found</div>
            {(search || statusFilter) && (
              <Button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                }}
              >
                Clear Filters
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <Card key={submission.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        {submission.name}
                      </h3>
                      {getStatusBadge(submission.status)}
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Email:</span> {submission.email}
                      {submission.company && (
                        <>
                          <span className="mx-2">•</span>
                          <span className="font-medium">Company:</span> {submission.company}
                        </>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-500 mb-4">
                      Submitted on {formatDate(submission.created_at)}
                    </div>
                    
                    <div className="bg-gray-50 rounded-md p-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {submission.message}
                      </p>
                    </div>
                  </div>
                  
                  <div className="ml-6 flex flex-col space-y-2">
                    {submission.status === ContactStatus.NEW && (
                      <Button
                        size="sm"
                        onClick={() => handleMarkAsRead(submission.id)}
                        disabled={markAsRead.isPending}
                      >
                        Mark as Read
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const subject = `Re: Contact Form Submission`;
                        const body = `Hi ${submission.name},\n\nThank you for contacting us.\n\nBest regards,\nSaaS Platform Team`;
                        window.open(`mailto:${submission.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
                      }}
                    >
                      Reply
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(submission.id)}
                      disabled={deleteSubmission.isPending}
                      className="text-red-600 hover:text-red-700"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}