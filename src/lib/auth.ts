import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const DEFAULT_PIN = 'ceh2026';

async function getAdminPin(): Promise<string> {
  const envPin = process.env.ADMIN_PIN;
  if (envPin) return envPin;

  try {
    const setting = await db.appSetting.findUnique({ where: { key: 'adminPin' } });
    if (setting?.value) return setting.value;
  } catch {}

  return DEFAULT_PIN;
}

export async function requireAdminAuth(req: NextRequest): Promise<{ authorized: boolean; response?: NextResponse }> {
  const pin = req.headers.get('x-admin-pin');
  if (!pin) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const validPin = await getAdminPin();

  if (pin !== validPin) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { authorized: true };
}
