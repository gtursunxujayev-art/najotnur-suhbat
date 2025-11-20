import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function shouldSend30MinReminder(eventDate: Date, now: Date): boolean {
  const diffMinutes = (eventDate.getTime() - now.getTime()) / 60000;
  const target = 30; // 30 minutes
  const window = 5; // ±5 minutes
  return diffMinutes > target - window && diffMinutes <= target + window;
}

export async function GET() {
  const now = new Date();

  try {
    const events = await prisma.event.findMany({
      where: { isActive: true }
    });

    for (const event of events) {
      if (!shouldSend30MinReminder(event.dateTime, now)) continue;

      const ues = await prisma.userEvent.findMany({
        where: {
          eventId: event.id,
          coming: true,
          reminded3: false
        },
        include: {
          user: true
        }
      });

      for (const ue of ues) {
        try {
          await sendTelegramMessage(
            Number(ue.user.telegramId),
            `"${event.title}" tadbiri 30 daqiqadan so‘ng boshlanadi. Tez orada ko‘rishamiz!`
          );

          await prisma.userEvent.update({
            where: { id: ue.id },
            data: { reminded3: true }
          });
        } catch (e) {
          console.error(
            'Failed to send 30-min reminder to userEvent',
            ue.id,
            e
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('GET /api/events/remind-30min error:', err);
    return NextResponse.json({ ok: false, error: 'Internal error' });
  }
}
