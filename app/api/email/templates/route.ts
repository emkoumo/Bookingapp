import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      )
    }

    const templates = await prisma.emailTemplate.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error('Error fetching email templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email templates' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    console.log('PATCH request body:', body)
    const { id, subject, body: emailBody, imageUrl, includeImageByDefault } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    console.log('Updating template with:', {
      id,
      subject,
      emailBody,
      imageUrl,
      includeImageByDefault,
    })

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: {
        subject,
        body: emailBody,
        imageUrl,
        includeImageByDefault,
      },
    })

    return NextResponse.json(template)
  } catch (error) {
    console.error('Error updating email template:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to update email template', details: errorMessage },
      { status: 500 }
    )
  }
}
