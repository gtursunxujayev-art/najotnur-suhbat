import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function shouldSend1HourReminder(eventDate: Date, now: Date): boolean {
  const diffMinutes = (eventDate.getTime() - now.getTime()) / 60000;
  const target = 60; // 60 minutes
  const window = 10; // ±10 minutes
  return diffMinutes > target - window && diffMinutes <= target + window;
}

export async function GET() {
  const now = new Date();

  try {
    const events = await prisma.event.findMany({
      where: { isActive: true }
    });

    for (const event of events) {
      if (!shouldSend1HourReminder(event.dateTime, now)) continue;

      const ues = await prisma.userEvent.findMany({
        where: {
          eventId: event.id,
          coming: true,
          reminded2: false
        },
        include: {
          user: true
        }
      });

      for (const ue of ues) {
        try {
          await sendTelegramMessage(
            Number(ue.user.telegramId),
            `"${event.title}" tadbiri 1 soatdan so‘ng boshlanadi. Kutib qolamiz!`
          );

          await prisma.userEvent.update({
            where: { id: ue.id },
            data: { reminded2: true }
          });
        } catch (e) {
          console.error(
            'Failed to send 1-hour reminder to userEvent',
            ue.id,
            e
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('GET /api/events/remind-1hour error:', err);
    return NextResponse.json({ ok: false, error: 'Internal error' });
  }
}
