import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function shouldSend1DayReminder(eventDate: Date, now: Date): boolean {
  const diffMinutes = (eventDate.getTime() - now.getTime()) / 60000;
  const target = 24 * 60; // 24 hours
  const window = 30; // ±30 minutes
  return diffMinutes > target - window && diffMinutes <= target + window;
}

async function sendEventConfirmKeyboard(
  chatId: bigint,
  text: string,
  userEventId: number
) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not set');
    return;
  }

  try {
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: String(chatId),
          text,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'Kelaman',
                  callback_data: `event_yes:${userEventId}`
                }
              ],
              [
                {
                  text: 'Kela olmayman',
                  callback_data: `event_no:${userEventId}`
                }
              ]
            ]
          }
        })
      }
    );
  } catch (e) {
    console.error('Failed to send 1-day reminder keyboard:', e);
  }
}

export async function GET() {
  const now = new Date();

  try {
    const events = await prisma.event.findMany({
      where: { isActive: true }
    });

    for (const event of events) {
      if (!shouldSend1DayReminder(event.dateTime, now)) continue;

      const ues = await prisma.userEvent.findMany({
        where: {
          eventId: event.id,
          reminded1: false
        },
        include: {
          user: true
        }
      });

      for (const ue of ues) {
        try {
          const text = `Ertaga "${event.title}" tadbiri bo‘lib o‘tadi. Kelasizmi?`;
          await sendEventConfirmKeyboard(
            ue.user.telegramId,
            text,
            ue.id
          );

          await prisma.userEvent.update({
            where: { id: ue.id },
            data: { reminded1: true }
          });
        } catch (e) {
          console.error(
            'Failed to send 1-day reminder to userEvent',
            ue.id,
            e
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('GET /api/events/remind-1day error:', err);
    return NextResponse.json({ ok: false, error: 'Internal error' });
  }
}
