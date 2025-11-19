import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      phone: u.phone,
      job: u.job,
      createdAt: u.createdAt
    }))
  );
}
