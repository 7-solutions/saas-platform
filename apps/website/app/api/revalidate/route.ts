import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path, tag, secret } = body;

    // Verify the secret to prevent unauthorized revalidation
    if (secret !== process.env.REVALIDATION_SECRET) {
      return NextResponse.json(
        { message: 'Invalid secret' },
        { status: 401 }
      );
    }

    if (path) {
      // Revalidate specific path
      revalidatePath(path);
      return NextResponse.json({ 
        revalidated: true, 
        path,
        now: Date.now() 
      });
    }

    if (tag) {
      // Revalidate by tag
      revalidateTag(tag);
      return NextResponse.json({ 
        revalidated: true, 
        tag,
        now: Date.now() 
      });
    }

    return NextResponse.json(
      { message: 'Missing path or tag parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json(
      { message: 'Error revalidating' },
      { status: 500 }
    );
  }
}