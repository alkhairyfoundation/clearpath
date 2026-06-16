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

// POST create student (public - for self-registration via attendance)
export async function POST(req: NextRequest) {
  try {
    const { name, email, department, faceImage, faceDescriptor } = await req.json();
    
    if (!name || !email || !department) {
      return NextResponse.json({ error: 'Name, email, and department are required' }, { status: 400 });
    }

    const student = await db.student.create({
      data: {
        name,
        email,
        department,
        faceImage: faceImage || null,
        faceDescriptor: faceDescriptor || null,
      },
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

// PUT update student (admin only)
export async function PUT(req: NextRequest) {
  const { authorized, response } = await requireAdminAuth(req);
  if (!authorized) return response;
  try {
    const { id, name, email, department, faceImage, faceDescriptor } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (department !== undefined) data.department = department;
    if (faceImage !== undefined) data.faceImage = faceImage;
    if (faceDescriptor !== undefined) data.faceDescriptor = faceDescriptor;

    const student = await db.student.update({ where: { id }, data });
    return NextResponse.json(student);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Another student with this email already exists' }, { status: 409 });
    }
    console.error('Students PUT error:', error);
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 });
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
