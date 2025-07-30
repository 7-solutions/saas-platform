import { NextResponse } from 'next/server';
import { getBlogRSSFeed } from '../../../lib/cms';

export async function GET() {
  try {
    const rssContent = await getBlogRSSFeed();
    
    if (!rssContent) {
      return new NextResponse('RSS feed not available', { status: 404 });
    }

    return new NextResponse(rssContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Enable ISR
export const revalidate = 3600; // 1 hour