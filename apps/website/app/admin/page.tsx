'use client';

import { AdminLayout } from '../../components/admin/AdminLayout';
import { Card } from '@saas-platform/ui';
import { useContactSubmissions, ContactStatus } from '@saas-platform/shared';

export default function AdminDashboardPage() {
  const { data: submissionsResponse } = useContactSubmissions({
    page_size: 100,
  });

  const submissions = submissionsResponse?.data?.submissions || [];
  
  // Calculate stats
  const totalSubmissions = submissions.length;
  const newSubmissions = submissions.filter(s => s.status === ContactStatus.NEW).length;
  const readSubmissions = submissions.filter(s => s.status === ContactStatus.READ).length;
  const repliedSubmissions = submissions.filter(s => s.status === ContactStatus.REPLIED).length;

  const stats = [
    {
      name: 'Total Submissions',
      value: totalSubmissions,
      icon: '📧',
      color: 'text-blue-600',
    },
    {
      name: 'New Submissions',
      value: newSubmissions,
      icon: '🆕',
      color: 'text-green-600',
    },
    {
      name: 'Read Submissions',
      value: readSubmissions,
      icon: '👁️',
      color: 'text-yellow-600',
    },
    {
      name: 'Replied Submissions',
      value: repliedSubmissions,
      icon: '✅',
      color: 'text-purple-600',
    },
  ];

  const recentSubmissions = submissions
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-700">
            Overview of your SaaS platform activity
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.name} className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">{stat.icon}</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className={`text-lg font-medium ${stat.color}`}>
                      {stat.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Recent Submissions */}
        <Card className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Recent Contact Submissions
          </h2>
          
          {recentSubmissions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No contact submissions yet
            </div>
          ) : (
            <div className="space-y-4">
              {recentSubmissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-gray-900">
                        {submission.name}
                      </span>
                      <span className="text-sm text-gray-500">
                        {submission.email}
                      </span>
                      {submission.status === ContactStatus.NEW && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1 truncate">
                      {submission.message}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDate(submission.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href="/admin/contact"
              className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="text-2xl mr-3">📧</span>
              <div>
                <div className="font-medium text-gray-900">View Contact Submissions</div>
                <div className="text-sm text-gray-500">Manage contact form submissions</div>
              </div>
            </a>
            
            <a
              href="/admin/pages"
              className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="text-2xl mr-3">📄</span>
              <div>
                <div className="font-medium text-gray-900">Manage Pages</div>
                <div className="text-sm text-gray-500">Create and edit website pages</div>
              </div>
            </a>
            
            <a
              href="/admin/blog"
              className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="text-2xl mr-3">📝</span>
              <div>
                <div className="font-medium text-gray-900">Manage Blog</div>
                <div className="text-sm text-gray-500">Write and publish blog posts</div>
              </div>
            </a>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}