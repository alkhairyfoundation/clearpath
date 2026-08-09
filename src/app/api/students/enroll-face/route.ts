import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidDescriptor, normalizeDescriptor } from '@/lib/face-descriptor';

export async function POST(req: NextRequest) {
  try {
    const { studentId, faceDescriptor, faceImage, quality } = await req.json();

    if (!studentId || !faceDescriptor) {
      return NextResponse.json({ error: 'Student ID and face descriptor are required' }, { status: 400 });
    }

    if (!isValidDescriptor(faceDescriptor)) {
      return NextResponse.json({ error: 'Face descriptor must be an array of 128 finite floats' }, { status: 400 });
    }

    // Always store a normalized (unit-length) descriptor so matching is consistent.
    const unitDescriptor = normalizeDescriptor(faceDescriptor);

    const student = await db.student.update({
      where: { id: studentId },
      data: {
        faceDescriptor: unitDescriptor,
        faceImage: faceImage || undefined,
        faceDescriptorQuality: typeof quality === 'number' ? quality : undefined,
      },
    });

    return NextResponse.json({ success: true, student, quality });
  } catch (error: any) {
    console.error('Enroll face error:', error);
    return NextResponse.json({ error: 'Failed to enroll face' }, { status: 500 });
  }
}
