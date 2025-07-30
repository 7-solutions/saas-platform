'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card } from '@saas-platform/ui'
import { FileText, Image, Users, Eye, TrendingUp, Clock } from 'lucide-react'

interface DashboardStats {
  totalPages: number
  publishedPages: number
  draftPages: number
  totalMedia: number
  totalUsers: number
  recentActivity: Array<{
    id: string
    type: 'page_created' | 'page_updated' | 'media_uploaded'
    title: string
    timestamp: string
  }>
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<DashboardStats>({
    totalPages: 0,
    publishedPages: 0,
    draftPages: 0,
    totalMedia: 0,
    totalUsers: 0,
    recentActivity: []
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading dashboard statistics
    // In a real implementation, this would fetch from the API
    const loadStats = async () => {
      try {
        // Mock data for now - will be replaced with actual API calls in later tasks
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        setStats({
          totalPages: 12,
          publishedPages: 8,
          draftPages: 4,
          totalMedia: 24,
          totalUsers: 3,
          recentActivity: [
            {
              id: '1',
              type: 'page_created',
              title: 'New homepage created',
              timestamp: '2 hours ago'
            },
            {
              id: '2',
              type: 'media_uploaded',
              title: 'Hero image uploaded',
              timestamp: '4 hours ago'
            },
            {
              id: '3',
              type: 'page_updated',
              title: 'About page updated',
              timestamp: '1 day ago'
            }
          ]
        })
      } catch (error) {
        console.error('Failed to load dashboard stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadStats()
  }, [])

  const statCards = [
    {
      title: 'Total Pages',
      value: stats.totalPages,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Published Pages',
      value: stats.publishedPages,
      icon: Eye,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Draft Pages',
      value: stats.draftPages,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100'
    },
    {
      title: 'Media Files',
      value: stats.totalMedia,
      icon: Image,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: 'Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100'
    }
  ]

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'page_created':
      case 'page_updated':
        return FileText
      case 'media_uploaded':
        return Image
      default:
        return TrendingUp
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'page_created':
        return 'text-green-600'
      case 'page_updated':
        return 'text-blue-600'
      case 'media_uploaded':
        return 'text-purple-600'
      default:
        return 'text-gray-600'
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome back, {session?.user?.name}!
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Here's what's happening with your content.
          </p>
        </div>
        
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome back, {session?.user?.name}!
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Here's what's happening with your content.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title} className="p-6">
              <div className="flex items-center">
                <div className={`flex-shrink-0 ${stat.bgColor} rounded-md p-3`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.title}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stat.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Recent Activity
          </h3>
          <div className="space-y-4">
            {stats.recentActivity.length > 0 ? (
              stats.recentActivity.map((activity) => {
                const Icon = getActivityIcon(activity.type)
                const colorClass = getActivityColor(activity.type)
                
                return (
                  <div key={activity.id} className="flex items-center space-x-3">
                    <div className={`flex-shrink-0 ${colorClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">
                        {activity.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        {activity.timestamp}
                      </p>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-gray-500">No recent activity</p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <Link href="/dashboard/pages/new" className="block w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
              <div className="flex items-center space-x-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-900">
                  Create New Page
                </span>
              </div>
            </Link>
            <Link href="/dashboard/media" className="block w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
              <div className="flex items-center space-x-3">
                <Image className="h-5 w-5 text-purple-600" />
                <span className="text-sm font-medium text-gray-900">
                  Upload Media
                </span>
              </div>
            </Link>
            <Link href="/dashboard/users" className="block w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
              <div className="flex items-center space-x-3">
                <Users className="h-5 w-5 text-indigo-600" />
                <span className="text-sm font-medium text-gray-900">
                  Manage Users
                </span>
              </div>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}