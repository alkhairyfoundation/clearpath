import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET quiz sessions / leaderboard
export async function GET() {
  try {
    const sessions = await db.quizSession.findMany({
      orderBy: [{ score: 'desc' }, { completedAt: 'asc' }],
      take: 50,
    });
    return NextResponse.json(sessions);
  } catch (error: any) {
    console.error('Quiz GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch quiz data' }, { status: 500 });
  }
}

// POST submit quiz session
export async function POST(req: NextRequest) {
  try {
    const { studentName, studentEmail, score, total, category } = await req.json();
    
    if (!studentName || score === undefined || !total) {
      return NextResponse.json({ error: 'Student name, score, and total are required' }, { status: 400 });
    }

    const session = await db.quizSession.create({
      data: { studentName, studentEmail: studentEmail || null, score, total, category: category || null },
    });
    
    return NextResponse.json(session, { status: 201 });
  } catch (error: any) {
    console.error('Quiz POST error:', error);
    return NextResponse.json({ error: 'Failed to save quiz session' }, { status: 500 });
  }
}
