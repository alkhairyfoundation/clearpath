import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth';

export async function GET() {
  try {
    const info = await db.schoolInfo.findMany({ orderBy: { updatedAt: 'desc' } });
    return NextResponse.json(info);
  } catch (error: any) {
    console.error('SchoolInfo GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch school info' }, { status: 500 });
  }
}

// POST - create (admin only)
export async function POST(req: NextRequest) {
  const { authorized, response } = await requireAdminAuth(req);
  if (!authorized) return response;
  try {
    const { category, title, content } = await req.json();
    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }
    const info = await db.schoolInfo.create({
      data: { category: category || 'general', title, content },
    });
    return NextResponse.json(info, { status: 201 });
  } catch (error: any) {
    console.error('SchoolInfo POST error:', error);
    return NextResponse.json({ error: 'Failed to create school info' }, { status: 500 });
  }
}

// PUT - update (admin only)
export async function PUT(req: NextRequest) {
  const { authorized, response } = await requireAdminAuth(req);
  if (!authorized) return response;
  try {
    const { id, category, title, content } = await req.json();
    if (!id || !title || !content) {
      return NextResponse.json({ error: 'ID, title, and content are required' }, { status: 400 });
    }
    const info = await db.schoolInfo.update({
      where: { id },
      data: { category: category || 'general', title, content },
    });
    return NextResponse.json(info);
  } catch (error: any) {
    console.error('SchoolInfo PUT error:', error);
    return NextResponse.json({ error: 'Failed to update school info' }, { status: 500 });
  }
}

// DELETE (admin only)
export async function DELETE(req: NextRequest) {
  const { authorized, response } = await requireAdminAuth(req);
  if (!authorized) return response;
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    await db.schoolInfo.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('SchoolInfo DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
