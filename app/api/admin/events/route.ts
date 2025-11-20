import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
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
    console.error('GET /api/admin/events error:', err);
    return NextResponse.json(
      { error: 'Failed to load events' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const titleRaw = (body.title ?? '').toString().trim();
    const dateTimeRaw = (body.dateTime ?? '').toString().trim();

    if (!titleRaw) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }
    if (!dateTimeRaw) {
      return NextResponse.json(
        { error: 'Date/time is required' },
        { status: 400 }
      );
    }

    const dt = new Date(dateTimeRaw);
    if (isNaN(dt.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date/time' },
        { status: 400 }
      );
    }

    const event = await prisma.event.create({
      data: {
        title: titleRaw,
        dateTime: dt
      }
    });

    return NextResponse.json({
      id: event.id,
      title: event.title,
      dateTime: event.dateTime.toISOString(),
      isActive: event.isActive
    });
  } catch (err) {
    console.error('POST /api/admin/events error:', err);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
