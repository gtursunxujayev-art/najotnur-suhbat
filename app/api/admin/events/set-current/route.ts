import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const eventIdRaw = body.eventId;

    const eventId = Number(eventIdRaw);
    if (!eventId || Number.isNaN(eventId)) {
      return NextResponse.json(
        { error: 'Invalid eventId' },
        { status: 400 }
      );
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Set all inactive, then one active
    await prisma.event.updateMany({ data: { isActive: false } });
    await prisma.event.update({
      where: { id: eventId },
      data: { isActive: true }
    });

    const events = await prisma.event.findMany({
      orderBy: { dateTime: 'asc' }
    });

    return NextResponse.json(
      events.map((e) => ({
        id: e.id,
        title: e.title,
        dateTime: e.dateTime.toISOString(),
        isActive: e.isActive
      }))
    );
  } catch (err) {
    console.error('POST /api/admin/events/set-current error:', err);
    return NextResponse.json(
      { error: 'Failed to set current event' },
      { status: 500 }
    );
  }
}
