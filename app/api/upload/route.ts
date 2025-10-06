import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const businessId = formData.get('businessId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate unique filename
    const timestamp = Date.now()
    const ext = path.extname(file.name)
    const filename = `${businessId}-${timestamp}${ext}`

    // Save to public/uploads
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', filename)
    await writeFile(uploadPath, buffer)

    // Return public URL
    const url = `/uploads/${filename}`

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
