import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Admin Telegram ID from ENV
const ADMIN_TELEGRAM_ID =
  process.env.ADMIN_TELEGRAM_ID ? BigInt(process.env.ADMIN_TELEGRAM_ID) : null;

// Bot token for direct API calls (copyMessage, sendMessage with buttons)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Send inline Yes/No keyboard to admin
async function sendConfirmKeyboard(chatId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN env is not set');
    return;
  }

  try {
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Ha, yubor', callback_data: 'broadcast_yes' }],
              [{ text: "Yo‘q, bekor qil", callback_data: 'broadcast_no' }]
            ]
          }
        })
      }
    );
  } catch (e) {
    console.error('Failed to send confirm keyboard:', e);
  }
}

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

  // =======================
  // 1) HANDLE CALLBACK QUERY
  // =======================
  const callback = update.callback_query;
  if (callback) {
    const callbackMessage = callback.message;
    const from = callback.from;
    const data: string = callback.data ?? '';

    if (!callbackMessage || !from) {
      return NextResponse.json({ ok: true });
    }

    const chatId: number = callbackMessage.chat.id;
    const fromId: bigint = BigInt(from.id);

    // Only admin can press these buttons
    if (!ADMIN_TELEGRAM_ID || fromId !== ADMIN_TELEGRAM_ID) {
      await sendTelegramMessage(
        chatId,
        'Bu tugmalar faqat admin uchun.'
      );
      return NextResponse.json({ ok: true });
    }

    const settings = await getBotSettings();

    if (data === 'broadcast_yes') {
      const fromChatId = settings.broadcastFromChatId;
      const messageId = settings.broadcastMessageId;

      if (!fromChatId || !messageId) {
        await sendTelegramMessage(
          chatId,
          'Yuboriladigan xabar topilmadi (broadcast maʼlumotlari yo‘q).'
        );
        return NextResponse.json({ ok: true });
      }

      if (!TELEGRAM_BOT_TOKEN) {
        console.error('TELEGRAM_BOT_TOKEN missing, cannot broadcast');
        await sendTelegramMessage(
          chatId,
          'Server konfiguratsiyasida xatolik (bot token topilmadi).'
        );
        return NextResponse.json({ ok: true });
      }

      const users = await prisma.user.findMany();
      let sent = 0;

      for (const u of users) {
        try {
          await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/copyMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: String(u.telegramId), // BigInt → string
                from_chat_id: String(fromChatId), // BigInt → string
                message_id: messageId
              })
            }
          );
          sent++;
        } catch (e) {
          console.error('Failed to copyMessage to user', u.id, e);
        }
      }

      // Clear broadcast message after sending
      await prisma.botSettings.update({
        where: { id: 1 },
        data: {
          broadcastFromChatId: null,
          broadcastMessageId: null
        }
      });

      await sendTelegramMessage(
        chatId,
        `Xabar ${sent} ta foydalanuvchiga yuborildi.`
      );
    }

    if (data === 'broadcast_no') {
      await prisma.botSettings.update({
        where: { id: 1 },
        data: {
          broadcastFromChatId: null,
          broadcastMessageId: null
        }
      });

      await sendTelegramMessage(chatId, 'Yuborish bekor qilindi.');
    }

    return NextResponse.json({ ok: true });
  }

  // =====================
  // 2) NORMAL MESSAGE FLOW
  // =====================
  const message = update.message ?? update.edited_message;
  if (!message) return NextResponse.json({ ok: true });

  const chatId: number = message.chat.id;
  const from = message.from;
  if (!from) return NextResponse.json({ ok: true });

  const telegramId: bigint = BigInt(from.id);
  const username: string | null = from.username ?? null;
  const textRaw: string =
    typeof message.text === 'string' ? message.text.trim() : '';

  try {
    const settings = await getBotSettings();

    // /start — reset conversation (for everyone)
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

    const isAdmin =
      ADMIN_TELEGRAM_ID !== null && telegramId === ADMIN_TELEGRAM_ID;

    // =========================
    //  ADMIN BROADCAST MODE
    //  any message from admin (not /start)
    // =========================
    if (isAdmin) {
      // Save the original message coordinates
      await prisma.botSettings.update({
        where: { id: 1 },
        data: {
          broadcastFromChatId: BigInt(message.chat.id),
          broadcastMessageId: message.message_id
        }
      });

      await sendConfirmKeyboard(
        chatId,
        'Bu xabarni barcha foydalanuvchilarga yuborishni xohlaysizmi?'
      );

      return NextResponse.json({ ok: true });
    }

    // ==========================
    // NORMAL USER REGISTRATION FLOW
    // ==========================
    let user = await getOrCreateUser(telegramId, username);

    if (!user) {
      await sendTelegramMessage(
        chatId,
        'Xatolik yuz berdi. Iltimos, /start bilan qayta urinib ko‘ring.'
      );
      return NextResponse.json({ ok: true });
    }

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

    if (!textRaw) {
      await sendTelegramMessage(
        chatId,
        'Iltimos, faqat matn yuboring. Boshlash uchun /start yuboring.'
      );
      return NextResponse.json({ ok: true });
    }

    const text = textRaw;

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

        const finalMessage =
          settings.finalMessage ||
          "Siz Najot Nurning 21-noyabr kuni bo'lib o'tadigan biznes nonushta suhbat dasturi uchun ro'yhatdan o'tdingiz. Sizga to'liq ma'lumot uchun menejerlarimiz bog'lanishadi.";

        await sendTelegramMessage(chatId, finalMessage);
        break;
      }

      case 'DONE': {
        await sendTelegramMessage(
          chatId,
          'Siz allaqachon ro‘yxatdan o‘tgan bo‘lsangiz kerak. Qayta boshlash uchun /start yuboring.'
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

    try {
      await sendTelegramMessage(
        chatId,
        'Serverda xatolik yuz berdi. Iltimos, keyinroq yana urinib ko‘ring.'
      );
    } catch (e) {
      console.error('Failed to send error message to Telegram:', e);
    }

    return NextResponse.json({ ok: true });
  }
}
