import { withAuth } from "next-auth/middleware"

export default withAuth(
  function middleware(req) {
    // Additional middleware logic can be added here
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Check if user is authenticated and has admin role
        if (req.nextUrl.pathname.startsWith('/dashboard')) {
          return token?.role === 'admin'
        }
        return !!token
      },
    },
  }
)

export const config = {
  matcher: ['/dashboard/:path*']
}