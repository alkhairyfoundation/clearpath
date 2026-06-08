import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth';

// GET all students
export async function GET() {
  try {
    const students = await db.student.findMany({
      orderBy: { registeredAt: 'desc' },
    });
    return NextResponse.json(students);
  } catch (error: any) {
    console.error('Students GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }
}

// POST create student (admin only)
export async function POST(req: NextRequest) {
  const { authorized, response } = await requireAdminAuth(req);
  if (!authorized) return response;
  try {
    const { name, email, department, faceImage } = await req.json();
    
    if (!name || !email || !department) {
      return NextResponse.json({ error: 'Name, email, and department are required' }, { status: 400 });
    }

    const student = await db.student.create({
      data: { name, email, department, faceImage: faceImage || null },
    });
    
    return NextResponse.json(student, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Student with this email already exists' }, { status: 409 });
    }
    console.error('Students POST error:', error);
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 });
  }
}

// DELETE student (admin only)
export async function DELETE(req: NextRequest) {
  const { authorized, response } = await requireAdminAuth(req);
  if (!authorized) return response;
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }
    
    await db.attendance.deleteMany({ where: { studentId: id } });
    await db.student.delete({ where: { id } });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Students DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 });
  }
}
