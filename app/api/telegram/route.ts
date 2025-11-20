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

// Bot token for direct fetch calls
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Confirmation keyboard
async function sendConfirmKeyboard(chatId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;

  try {
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          reply_markup: {
            inline_keyboard: [
              [{ text: "Ha, yubor", callback_data: "broadcast_yes" }],
              [{ text: "Yo‘q, bekor qil", callback_data: "broadcast_no" }]
            ]
          }
        })
      }
    );
  } catch (e) {
    console.error("Failed to send confirmation keyboard:", e);
  }
}

// Create or get user
async function getOrCreateUser(telegramId: bigint, username: string | null) {
  let existing = await prisma.user.findUnique({ where: { telegramId } });
  if (existing) return existing;

  try {
    return await prisma.user.create({
      data: {
        telegramId,
        username,
        name: "",
        phone: "",
        job: "",
        step: "ASK_NAME"
      }
    });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return await prisma.user.findUnique({ where: { telegramId } });
    }
    throw err;
  }
}

// Load or create settings
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
    console.error("Failed to parse Telegram update:", e);
    return NextResponse.json({ ok: true });
  }

  console.log("Telegram update:", JSON.stringify(update, null, 2));

  // =======================
  // CALLBACK QUERY HANDLING
  // =======================
  const callback = update.callback_query;
  if (callback) {
    const callbackMessage = callback.message;
    const from = callback.from;
    const data = callback.data;

    if (!callbackMessage || !from) return NextResponse.json({ ok: true });

    const chatId = callbackMessage.chat.id;
    const fromId = BigInt(from.id);

    // Only admin allowed
    if (!ADMIN_TELEGRAM_ID || fromId !== ADMIN_TELEGRAM_ID) {
      await sendTelegramMessage(chatId, "Bu tugmalar faqat admin uchun.");
      return NextResponse.json({ ok: true });
    }

    const settings = await getBotSettings();

    // YES → broadcast
    if (data === "broadcast_yes") {
      const textToSend = settings.broadcastText;

      if (!textToSend) {
        await sendTelegramMessage(chatId, "Hozircha yuboriladigan xabar yo‘q.");
        return NextResponse.json({ ok: true });
      }

      const users = await prisma.user.findMany();
      let sent = 0;

      for (const u of users) {
        try {
          await sendTelegramMessage(Number(u.telegramId), textToSend);
          sent++;
        } catch (e) {
          console.error("Failed to send broadcast:", e);
        }
      }

      await prisma.botSettings.update({
        where: { id: 1 },
        data: { broadcastText: null }
      });

      await sendTelegramMessage(chatId, `Xabar ${sent} ta foydalanuvchiga yuborildi.`);
    }

    // NO → cancel
    if (data === "broadcast_no") {
      await prisma.botSettings.update({
        where: { id: 1 },
        data: { broadcastText: null }
      });

      await sendTelegramMessage(chatId, "Yuborish bekor qilindi.");
    }

    return NextResponse.json({ ok: true });
  }

  // ====================
  // NORMAL MESSAGE FLOW
  // ====================
  const message = update.message ?? update.edited_message;
  if (!message) return NextResponse.json({ ok: true });

  const chatId = message.chat.id;
  const from = message.from;
  if (!from) return NextResponse.json({ ok: true });

  const telegramId = BigInt(from.id);
  const username = from.username ?? null;
  const textRaw = typeof message.text === "string" ? message.text.trim() : "";

  try {
    const settings = await getBotSettings();

    // RESET with /start
    if (textRaw === "/start") {
      let user = await prisma.user.findUnique({ where: { telegramId } });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            username,
            name: "",
            phone: "",
            job: "",
            step: "ASK_NAME"
          }
        });
      } else {
        await prisma.user.create({
          data: {
            telegramId,
            username,
            name: "",
            phone: "",
            job: "",
            step: "ASK_NAME"
          }
        });
      }

      await sendTelegramMessage(chatId, settings.greetingText);
      return NextResponse.json({ ok: true });
    }

    // Check if admin
    const isAdmin = ADMIN_TELEGRAM_ID !== null && telegramId === ADMIN_TELEGRAM_ID;

    // ====================
    // ADMIN BROADCAST MODE
    // ====================
    if (isAdmin && textRaw) {
      await prisma.botSettings.update({
        where: { id: 1 },
        data: { broadcastText: textRaw }
      });

      await sendConfirmKeyboard(
        chatId,
        "Bu xabarni barcha foydalanuvchilarga yuborishni xohlaysizmi?"
      );

      return NextResponse.json({ ok: true });
    }

    // ==========================
    // NORMAL USER REGISTRATION FLOW
    // ==========================
    let user = await getOrCreateUser(telegramId, username);

    if (!user) {
      await sendTelegramMessage(chatId, "Xatolik. /start yuborib qayta urinib ko‘ring.");
      return NextResponse.json({ ok: true });
    }

    // Update username if changed
    if (user.username !== username) {
      try {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { username }
        });
      } catch {}
    }

    if (!textRaw) {
      await sendTelegramMessage(
        chatId,
        "Iltimos, faqat matn yuboring. Boshlash uchun /start yuboring."
      );
      return NextResponse.json({ ok: true });
    }

    const text = textRaw;

    switch (user.step) {
      case "ASK_NAME":
        user = await prisma.user.update({
          where: { id: user.id },
          data: { name: text, step: "ASK_PHONE" }
        });
        await sendTelegramMessage(chatId, settings.askPhoneText);
        break;

      case "ASK_PHONE":
        user = await prisma.user.update({
          where: { id: user.id },
          data: { phone: text, step: "ASK_JOB" }
        });
        await sendTelegramMessage(chatId, settings.askJobText);
        break;

      case "ASK_JOB":
        user = await prisma.user.update({
          where: { id: user.id },
          data: { job: text, step: "DONE" }
        });

        await sendTelegramMessage(chatId, settings.finalMessage);
        break;

      case "DONE":
        await sendTelegramMessage(
          chatId,
          "Siz allaqachon ro‘yxatdan o‘tgan bo‘lsangiz kerak. /start yuboring."
        );
        break;

      default:
        await sendTelegramMessage(chatId, "Boshlash uchun /start yuboring.");
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("ERROR in Telegram route:", err);
    await sendTelegramMessage(chatId, "Serverda xatolik. Keyinroq urinib ko‘ring.");
    return NextResponse.json({ ok: true });
  }
}
