import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Create or get existing user
async function getOrCreateUser(telegramId: bigint, username: string | null) {
  let existing = await prisma.user.findUnique({
    where: { telegramId }
  });
  if (existing) return existing;

  try {
    return await prisma.user.create({
      data: {
        telegramId,
        username,
        name: '',
        phone: '',
        job: '',
        step: 'ASK_NAME'
      }
    });
  } catch (err: any) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return await prisma.user.findUnique({ where: { telegramId } });
    }
    throw err;
  }
}

// Load settings (create defaults if not exist)
async function getBotSettings() {
  return await prisma.botSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {}
  });
}

export async function POST(req: NextRequest) {
  let update: any;

  try {
    update = await req.json();
  } catch (e) {
    console.error('Failed to parse Telegram update:', e);
    return NextResponse.json({ ok: true });
  }

  console.log('Telegram update:', JSON.stringify(update, null, 2));

  const message = update.message ?? update.edited_message;
  if (!message) return NextResponse.json({ ok: true });

  const chatId: number = message.chat.id;
  const from = message.from;

  if (!from) return NextResponse.json({ ok: true });

  const telegramId: bigint = BigInt(from.id);
  const username: string | null = from.username ?? null;
  const textRaw: string = typeof message.text === 'string' ? message.text.trim() : '';

  try {
    const settings = await getBotSettings();

    // ================
    // /start — reset
    // ================
    if (textRaw === '/start') {
      let user = await prisma.user.findUnique({ where: { telegramId } });

      if (user) {
        await prisma.user.update({
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
        await prisma.user.create({
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

    // Ensure user exists
    let user = await getOrCreateUser(telegramId, username);

    // Update username if changed
    if (user.username !== username) {
      try {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { username }
        });
      } catch (e) {
        console.warn('Could not update username:', e);
      }
    }

    // If no text
    if (!textRaw) {
      await sendTelegramMessage(chatId, "Iltimos, faqat matn yuboring. Boshlash uchun /start yuboring.");
      return NextResponse.json({ ok: true });
    }

    const text = textRaw;

    // ===========================
    // Conversation steps
    // ===========================
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

        // Load final message
        const settingsDB = await prisma.botSettings.findFirst();
        const finalMessage =
          settingsDB?.finalMessage ||
          "Siz Najot Nurning 21-noyabr kuni bo'lib o'tadigan biznes nonushta suhbat dasturi uchun ro'yhatdan o'tdingiz. Sizga to'liq ma'lumot uchun menejerlarimiz bog'lanishadi.";

        await sendTelegramMessage(chatId, finalMessage);
        break;
      }

      case 'DONE': {
        await sendTelegramMessage(
          chatId,
          "Siz allaqachon ro‘yxatdan o‘tganmisiz. Qayta boshlash uchun /start yuboring."
        );
        break;
      }

      default: {
        await sendTelegramMessage(
          chatId,
          "Boshlash uchun /start buyrug‘ini yuboring."
        );
        break;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('ERROR in Telegram route:', err);

    await sendTelegramMessage(
      chatId,
      "Serverda xatolik yuz berdi. Iltimos, birozdan so‘ng qayta urinib ko‘ring."
    );

    return NextResponse.json({ ok: true });
  }
}