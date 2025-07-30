import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if the application is running properly
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'cms',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
    };

    return NextResponse.json(healthCheck, { status: 200 });
  } catch (error) {
    const errorResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'cms',
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    return NextResponse.json(errorResponse, { status: 503 });
  }
}