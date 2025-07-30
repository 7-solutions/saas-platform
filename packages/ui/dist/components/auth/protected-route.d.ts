import * as React from "react";
interface User {
    id: string;
    email: string;
    role: string;
    name?: string;
}
interface ProtectedRouteProps {
    children: React.ReactNode;
    user?: User | null;
    isLoading?: boolean;
    requiredRole?: string;
    fallback?: React.ReactNode;
    onLogin?: () => void;
}
export declare function ProtectedRoute({ children, user, isLoading, requiredRole, fallback, onLogin, }: ProtectedRouteProps): React.JSX.Element;
export type { User };
//# sourceMappingURL=protected-route.d.ts.map