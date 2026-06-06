import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PIN = 'ceh2026';

export function requireAdminAuth(req: NextRequest): { authorized: boolean; response?: NextResponse } {
  const pin = req.headers.get('x-admin-pin');
  if (pin !== ADMIN_PIN) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { authorized: true };
}
