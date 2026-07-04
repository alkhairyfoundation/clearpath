import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { startOfDay, endOfDay } from 'date-fns';

const todayRange = () => ({
  gte: startOfDay(new Date()),
  lte: endOfDay(new Date()),
});

// GET attendance records for today
export async function GET() {
  try {
    const records = await db.attendance.findMany({
      where: { timestamp: todayRange() },
      include: { student: true },
      orderBy: { timestamp: 'desc' },
    });
    return NextResponse.json(records);
  } catch (error: any) {
    console.error('Attendance GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
  }
}

// POST mark attendance
export async function POST(req: NextRequest) {
  try {
    const { studentId, method, confidence } = await req.json();
    
    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    // Check if already marked today
    const existing = await db.attendance.findFirst({
      where: { studentId, timestamp: todayRange() },
    });
    if (existing) {
      return NextResponse.json({ error: 'Student already marked as present', record: existing }, { status: 409 });
    }

    const record = await db.attendance.create({
      data: { 
        studentId, 
        method: method || 'manual', 
        confidence: confidence || null 
      },
      include: { student: true },
    });
    
    return NextResponse.json(record, { status: 201 });
  } catch (error: any) {
    console.error('Attendance POST error:', error);
    return NextResponse.json({ error: 'Failed to mark attendance' }, { status: 500 });
  }
}
