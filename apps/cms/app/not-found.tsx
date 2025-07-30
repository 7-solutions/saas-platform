import Link from 'next/link';
import { Button } from '@saas-platform/ui';
import { Home, Settings, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto text-center p-6">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-muted-foreground/20 mb-4">
            404
          </h1>
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Page Not Found
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            The CMS page you're looking for doesn't exist or you don't have permission to access it.
          </p>
        </div>

        <div className="space-y-4">
          <Button asChild className="w-full">
            <Link href="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Link>
          </Button>
          
          <Button variant="outline" asChild className="w-full">
            <Link href="/dashboard/pages">
              <Settings className="mr-2 h-4 w-4" />
              Manage Pages
            </Link>
          </Button>
          
          <Button variant="ghost" onClick={() => window.history.back()} className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>

        <div className="mt-8 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Need help? Contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  );
}