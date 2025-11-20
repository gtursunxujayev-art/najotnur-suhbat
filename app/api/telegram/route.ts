import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID
  ? BigInt(process.env.ADMIN_TELEGRAM_ID)
  : null;

// Check if telegramId is admin (via DB + optional ENV bootstrap)
async function isAdminTelegram(telegramId: bigint): Promise<boolean> {
  if (ADMIN_TELEGRAM_ID && telegramId === ADMIN_TELEGRAM_ID) {
    return true;
  }
  const admin = await prisma.admin.findUnique({ where: { telegramId } });
  return !!admin;
}

// Helper: send confirm keyboard for admin broadcast
async function sendBroadcastConfirmKeyboard(chatId: number, text: string) {
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
    console.error('Failed to send broadcast confirm keyboard:', e);
  }
}

// Create or get existing user
async function getOrCreateUser(
  telegramId: bigint,
  username: string | null
) {
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

// Get active event (one at a time)
async function getActiveEvent() {
  return await prisma.event.findFirst({
    where: { isActive: true },
    orderBy: { dateTime: 'asc' }
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
  // 1) CALLBACK QUERY HANDLING
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
    const fromTelegramId: bigint = BigInt(from.id);

    // ---- Broadcast callbacks (admin only) ----
    if (data === 'broadcast_yes' || data === 'broadcast_no') {
      const isAdmin = await isAdminTelegram(fromTelegramId);

      if (!isAdmin) {
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
            'Yuboriladigan xabar topilmadi.'
          );
          return NextResponse.json({ ok: true });
        }

        if (!TELEGRAM_BOT_TOKEN) {
          console.error('Missing TELEGRAM_BOT_TOKEN for broadcast');
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
                  chat_id: String(u.telegramId),
                  from_chat_id: String(fromChatId),
                  message_id: messageId
                })
              }
            );
            sent++;
          } catch (e) {
            console.error('Failed to send broadcast to user', u.id, e);
          }
        }

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

    // ---- Event confirmation callbacks (users) ----
    if (data.startsWith('event_yes:') || data.startsWith('event_no:')) {
      const parts = data.split(':');
      const idStr = parts[1];
      const userEventId = Number(idStr);

      if (!userEventId || Number.isNaN(userEventId)) {
        await sendTelegramMessage(chatId, 'Xatolik: noto‘g‘ri callback.');
        return NextResponse.json({ ok: true });
      }

      const ue = await prisma.userEvent.findUnique({
        where: { id: userEventId },
        include: { event: true, user: true }
      });

      if (!ue) {
        await sendTelegramMessage(
          chatId,
          'Bu eslatma topilmadi yoki eskirgan.'
        );
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith('event_yes:')) {
        await prisma.userEvent.update({
          where: { id: ue.id },
          data: { coming: true }
        });

        await sendTelegramMessage(
          chatId,
          `✅ Rahmat! Siz "${ue.event.title}" tadbiriga kelasiz deb belgilandi.`
        );
      } else {
        await prisma.userEvent.update({
          where: { id: ue.id },
          data: { coming: false }
        });

        await sendTelegramMessage(
          chatId,
          `❌ Siz "${ue.event.title}" tadbiriga bormaslikni tanladingiz.`
        );
      }

      return NextResponse.json({ ok: true });
    }

    // Unknown callback
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
    // /start — reset conversation (everyone)
    if (textRaw === '/start') {
      const settings = await getBotSettings();

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

    const isAdmin = await isAdminTelegram(telegramId);

    // =========================
    // ADMIN BROADCAST MODE (any message except /start)
    // =========================
    if (isAdmin) {
      const settings = await getBotSettings();

      await prisma.botSettings.update({
        where: { id: settings.id },
        data: {
          broadcastFromChatId: BigInt(message.chat.id),
          broadcastMessageId: message.message_id
        }
      });

      await sendBroadcastConfirmKeyboard(
        chatId,
        'Bu xabarni barcha foydalanuvchilarga yuborishni xohlaysizmi?'
      );

      return NextResponse.json({ ok: true });
    }

    // ==========================
    // NORMAL USER REGISTRATION FLOW
    // ==========================
    const settings = await getBotSettings();

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

        // Link user to active event (if any)
        const activeEvent = await getActiveEvent();

        if (activeEvent) {
          await prisma.userEvent.upsert({
            where: {
              userId_eventId: {
                userId: user.id,
                eventId: activeEvent.id
              }
            },
            update: {},
            create: {
              userId: user.id,
              eventId: activeEvent.id
            }
          });
        }

        const finalMessage = settings.finalMessage;

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
