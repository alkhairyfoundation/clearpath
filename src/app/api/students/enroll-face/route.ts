import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { studentId, faceDescriptor, faceImage } = await req.json();

    if (!studentId || !faceDescriptor) {
      return NextResponse.json({ error: 'Student ID and face descriptor are required' }, { status: 400 });
    }

    if (!Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return NextResponse.json({ error: 'Face descriptor must be an array of 128 floats' }, { status: 400 });
    }

    const student = await db.student.update({
      where: { id: studentId },
      data: {
        faceDescriptor: faceDescriptor,
        faceImage: faceImage || undefined,
      },
    });

    return NextResponse.json({ success: true, student });
  } catch (error: any) {
    console.error('Enroll face error:', error);
    return NextResponse.json({ error: 'Failed to enroll face' }, { status: 500 });
  }
}
