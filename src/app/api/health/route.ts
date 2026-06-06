import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - start;

    const studentCount = await db.student.count();
    const attendanceCount = await db.attendance.count();

    const memoryUsage = (process.memoryUsage?.()?.heapUsed
      ? Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      : 0) + 'MB';

    return NextResponse.json({
      status: 'healthy',
      version: '1.0.0',
      uptime: Math.floor(process.uptime?.() || 0),
      db: dbLatency < 100 ? 'Connected' : 'Slow',
      dbLatency: `${dbLatency}ms`,
      api: 'Operational',
      memoryUsage,
      students: studentCount,
      attendance: attendanceCount,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      status: 'degraded',
      version: '1.0.0',
      uptime: Math.floor(process.uptime?.() || 0),
      db: 'Disconnected',
      api: 'Operational',
      memoryUsage: 'N/A',
      students: 0,
      attendance: 0,
      timestamp: new Date().toISOString(),
    });
  }
}
