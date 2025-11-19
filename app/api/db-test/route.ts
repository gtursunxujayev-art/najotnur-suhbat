import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const users = await prisma.user.findMany();
    return NextResponse.json({ ok: true, count: users.length });
  } catch (err: any) {
    console.error('DB test error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: String(err),
      },
      { status: 500 }
    );
  }
}
