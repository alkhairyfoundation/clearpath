import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const sessions = await db.quizSession.findMany({
      orderBy: [{ score: 'desc' }, { completedAt: 'asc' }],
      take: 20,
    });
    
    const leaderboard = sessions.map((s, i) => ({
      rank: i + 1,
      studentName: s.studentName,
      score: s.score,
      total: s.total,
      percentage: Math.round((s.score / s.total) * 100),
      category: s.category,
      completedAt: s.completedAt,
    }));
    
    return NextResponse.json(leaderboard);
  } catch (error: any) {
    console.error('Leaderboard GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
