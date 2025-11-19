import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const userIds = Array.isArray(body.userIds) ? body.userIds : [];
    const text = (body.text ?? '').toString().trim();

    if (!text) {
      return NextResponse.json(
        { error: 'Message text is empty' },
        { status: 400 }
      );
    }

    if (userIds.length === 0) {
      return NextResponse.json(
        { error: 'No users selected' },
        { status: 400 }
      );
    }

    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      }
    });

    let sentCount = 0;

    await Promise.all(
      users.map((u) =>
        // telegramId is BIGINT now → convert to string for Telegram API
        sendTelegramMessage(String(u.telegramId), text).then(
          () => {
            sentCount += 1;
          },
          (err) => {
            console.error(
              'Failed to send message to',
              u.telegramId.toString(),
              err
            );
          }
        )
      )
    );

    return NextResponse.json({ ok: true, sent: sentCount });
  } catch (err) {
    console.error('Admin message API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
