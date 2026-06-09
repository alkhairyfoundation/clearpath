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

// POST submit quiz session(s) — single or batch (battle mode)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Batch submission (battle mode): { participants: [{ studentName, score, total, category }] }
    if (body.participants && Array.isArray(body.participants)) {
      if (body.participants.length === 0) {
        return NextResponse.json({ error: 'Participants array is empty' }, { status: 400 });
      }
      const created = await db.$transaction(
        body.participants.map((p: any) =>
          db.quizSession.create({
            data: {
              studentName: p.studentName,
              studentEmail: p.studentEmail || null,
              score: p.score,
              total: p.total,
              category: p.category || null,
            },
          })
        )
      );
      return NextResponse.json(created, { status: 201 });
    }

    // Single submission
    const { studentName, studentEmail, score, total, category } = body;
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
