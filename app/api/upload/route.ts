import { NextRequest, NextResponse } from 'next/server'

/**
 * File upload API route
 *
 * NOTE: This route does NOT work on Vercel serverless functions
 * because the filesystem is read-only.
 *
 * RECOMMENDED SOLUTION:
 * Use external image hosting services like:
 * - Imgur.com (free, no account needed)
 * - Cloudinary
 * - ImgBB
 *
 * Simply paste the image URL in the "URL εικόνας" field instead of uploading.
 *
 * For proper file uploads on Vercel, you need to:
 * 1. Install: npm install @vercel/blob
 * 2. Enable Vercel Blob storage in your project
 * 3. Add BLOB_READ_WRITE_TOKEN to environment variables
 *
 * See: https://vercel.com/docs/storage/vercel-blob
 */

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json({
      error: 'File upload not available on serverless. Please use image URL instead.',
      suggestion: 'Upload your image to Imgur.com and paste the URL in the "URL εικόνας" field below.'
    }, { status: 501 })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({
      error: 'Upload failed. Please use image URL instead.'
    }, { status: 500 })
  }
}
