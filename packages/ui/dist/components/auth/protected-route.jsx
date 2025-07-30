import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Loader2, Lock } from "lucide-react";
export function ProtectedRoute({ children, user, isLoading = false, requiredRole, fallback, onLogin, }) {
    // Show loading state
    if (isLoading) {
        return (<div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin"/>
          <span>Loading...</span>
        </div>
      </div>);
    }
    // Show unauthorized if no user
    if (!user) {
        if (fallback) {
            return <>{fallback}</>;
        }
        return (<div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Lock className="h-6 w-6"/>
            </div>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              You need to be signed in to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {onLogin && (<Button onClick={onLogin} className="w-full">
                Sign In
              </Button>)}
          </CardContent>
        </Card>
      </div>);
    }
    // Check role-based access
    if (requiredRole && user.role !== requiredRole) {
        return (<div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Lock className="h-6 w-6"/>
            </div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access this page. Required role: {requiredRole}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>);
    }
    // User is authenticated and authorized
    return <>{children}</>;
}
