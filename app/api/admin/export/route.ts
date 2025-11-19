import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' }
  });

  const header = ['id', 'name', 'username', 'phone', 'job', 'createdAt'];
  const rows = users.map((u) => [
    u.id,
    u.name,
    u.username ?? '',
    u.phone,
    u.job,
    u.createdAt.toISOString()
  ]);

  const csv =
    [header.join(','), ...rows.map((r) => r.map(String).join(','))].join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="users.csv"'
    }
  });
}
