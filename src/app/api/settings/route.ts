import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth';

// GET settings
export async function GET() {
  try {
    const settings = await db.appSetting.findMany();
    const settingsMap: Record<string, string> = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });
    return NextResponse.json(settingsMap);
  } catch (error: any) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// POST update settings (admin only)
export async function POST(req: NextRequest) {
  const { authorized, response } = requireAdminAuth(req);
  if (!authorized) return response;
  try {
    const { key, value } = await req.json();
    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 });
    }

    const setting = await db.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    
    return NextResponse.json(setting);
  } catch (error: any) {
    console.error('Settings POST error:', error);
    return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 });
  }
}
