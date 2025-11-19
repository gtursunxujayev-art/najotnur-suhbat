import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  buildQrUrl,
  sendTelegramMessage,
  sendTelegramPhoto
} from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Helper: get or create user, telegramId is BIGINT now
async function getOrCreateUser(telegramId: bigint, username: string | null) {
  let existing = await prisma.user.findUnique({
    where: { telegramId }
  });
  if (existing) return existing;

  try {
    const created = await prisma.user.create({
      data: {
        telegramId,
        username,
        name: '',
        phone: '',
        job: '',
        step: 'ASK_NAME'
      }
    });
    return created;
  } catch (err: any) {
    // If parallel request created same telegramId (unique), read again
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const again = await prisma.user.findUnique({
        where: { telegramId }
      });
      if (again) return again;
    }
    throw err;
  }
}

async function getBotSettings() {
  const settings = await prisma.botSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {}
  });
  return settings;
}

export async function POST(req: NextRequest) {
  let update: any;
  try {
    update = await req.json();
  } catch (e) {
    console.error('Failed to parse Telegram update JSON:', e);
    return NextResponse.json({ ok: true });
  }

  console.log('Telegram update:', JSON.stringify(update, null, 2));

  const message = update.message ?? update.edited_message;
  if (!message) return NextResponse.json({ ok: true });

  const chat = message.chat;
  const from = message.from;

  if (!chat || !from || !chat.id) {
    console.log('Missing chat/from', { chat, from });
    return NextResponse.json({ ok: true });
  }

  const chatId: number = chat.id; // okay as number for sendMessage
  // 👉 telegramId MUST be bigint for Prisma:
  const telegramId: bigint = BigInt(from.id);
  const username: string | null = from.username ?? null;
  const textRaw: string =
    typeof message.text === 'string' ? message.text.trim() : '';

  try {
    const settings = await getBotSettings();

    // ========================
    // /start → reset flow
    // ========================
    if (textRaw === '/start') {
      let user = await prisma.user.findUnique({ where: { telegramId } });

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            username,
            name: '',
            phone: '',
            job: '',
            step: 'ASK_NAME'
          }
        });
      } else {
        user = await prisma.user.create({
          data: {
            telegramId,
            username,
            name: '',
            phone: '',
            job: '',
            step: 'ASK_NAME'
          }
        });
      }

      await sendTelegramMessage(chatId, settings.greetingText);
      return NextResponse.json({ ok: true });
    }

    // Ensure user exists (race-safe)
    let user = await getOrCreateUser(telegramId, username);

    // Update username if changed (non-critical)
    if (user.username !== username) {
      try {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { username }
        });
      } catch (e) {
        console.warn('Failed to update username', e);
      }
    }

    const text = textRaw;

    // If no text (photo, sticker, contact, etc.)
    if (!text) {
      await sendTelegramMessage(
        chatId,
        'Iltimos, faqat matn yuboring. Boshlash uchun /start yuboring.'
      );
      return NextResponse.json({ ok: true });
    }

    // ========================
    // Step-by-step flow
    // ========================
    switch (user.step) {
      case 'ASK_NAME': {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { name: text, step: 'ASK_PHONE' }
        });

        await sendTelegramMessage(chatId, settings.askPhoneText);
        break;
      }

      case 'ASK_PHONE': {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { phone: text, step: 'ASK_JOB' }
        });

        await sendTelegramMessage(chatId, settings.askJobText);
        break;
      }

      case 'ASK_JOB': {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { job: text, step: 'DONE' }
        });

        // For scanner + Google Sheets: "Name,Phone"
        const qrText = `${user.name},${user.phone}`;
        const qrUrl = buildQrUrl(qrText);

        await sendTelegramMessage(
          chatId,
          'Rahmat! Mana sizning QR-kodingiz:'
        );
        await sendTelegramPhoto(
          chatId,
          qrUrl,
          `QR matni:\n${qrText}`
        );
        break;
      }

      case 'DONE': {
        await sendTelegramMessage(
          chatId,
          "Siz allaqachon roʻyxatdan oʻtgansiz. Qayta boshlash uchun /start yuboring."
        );
        break;
      }

      default: {
        await sendTelegramMessage(
          chatId,
          'Boshlash uchun /start buyrugʻini yuboring.'
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Prisma / bot logic error:', err);

    const code = err?.code || 'NO_CODE';
    const msg =
      typeof err?.message === 'string'
        ? err.message.slice(0, 120)
        : 'NO_MESSAGE';

    await sendTelegramMessage(
      chatId,
      "Serverda xatolik yuz berdi 😔 Iltimos, birozdan so'ng qayta urinib ko'ring.\n\n" +
        `Tech info: ${code} | ${msg}`
    );

    return NextResponse.json({ ok: true });
  }
}
