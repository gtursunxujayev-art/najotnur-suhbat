import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    let userIds: number[] = [];
    let text = '';
    let file: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();

      const userIdsRaw = formData.get('userIds');
      if (userIdsRaw) {
        const str =
          typeof userIdsRaw === 'string'
            ? userIdsRaw
            : userIdsRaw.toString();
        try {
          const parsed = JSON.parse(str);
          if (Array.isArray(parsed)) {
            userIds = parsed
              .map((val: unknown) => Number(val))
              .filter((val: number) => !Number.isNaN(val));
          }
        } catch (e) {
          console.error('Failed to parse userIds JSON:', e);
        }
      }

      const textField = formData.get('text');
      text =
        typeof textField === 'string'
          ? textField
          : textField?.toString() ?? '';

      const fileCandidate = formData.get('file');
      if (fileCandidate instanceof File) {
        file = fileCandidate;
      }
    } else {
      const body: any = await req.json();
      if (Array.isArray(body.userIds)) {
        userIds = (body.userIds as unknown[])
          .map((val: unknown) => Number(val))
          .filter((val: number) => !Number.isNaN(val));
      }
      text = typeof body.text === 'string' ? body.text : '';
    }

    if (!userIds.length) {
      return NextResponse.json(
        { error: 'No users selected' },
        { status: 400 }
      );
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.error('TELEGRAM_BOT_TOKEN is not set');
      return NextResponse.json(
        { error: 'Bot token is not configured' },
        { status: 500 }
      );
    }

    const hasImage = !!file;
    let imageBuffer: ArrayBuffer | null = null;
    let mimeType = '';
    let fileName = '';

    if (hasImage && file) {
      imageBuffer = await file.arrayBuffer();
      mimeType = file.type || 'image/jpeg';
      fileName = file.name || 'image.jpg';
    }

    let sent = 0;

    for (const id of userIds) {
      const user = await prisma.user.findUnique({
        where: { id }
      });
      if (!user) continue;

      const chatId = Number(user.telegramId);

      try {
        if (hasImage && imageBuffer) {
          const form = new FormData();
          form.append('chat_id', chatId.toString());
          if (text) {
            form.append('caption', text);
          }

          const blob = new Blob([imageBuffer], { type: mimeType });
          form.append('photo', blob, fileName);

          await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: 'POST',
            body: form as any
          });
        } else if (text) {
          await sendTelegramMessage(chatId, text);
        } else {
          // neither text nor image – skip
          continue;
        }

        sent++;
      } catch (err) {
        console.error(`Failed to send message to user ${id}`, err);
      }
    }

    return NextResponse.json({ sent });
  } catch (err) {
    console.error('Error in /api/admin/message:', err);
    return NextResponse.json(
      { error: 'Failed to send messages' },
      { status: 500 }
    );
  }
}