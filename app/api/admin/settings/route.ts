import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Ensure we always have exactly one settings row
async function getOrCreateSettings() {
  const settings = await prisma.botSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {}
  });
  return settings;
}

export async function GET() {
  try {
    const settings = await getOrCreateSettings();

    return NextResponse.json({
      greetingText: settings.greetingText,
      askPhoneText: settings.askPhoneText,
      askJobText: settings.askJobText,
      finalMessage: settings.finalMessage
    });
  } catch (err) {
    console.error('GET /api/admin/settings error:', err);
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));

    let greetingText = (body.greetingText ?? '').toString().trim();
    let askPhoneText = (body.askPhoneText ?? '').toString().trim();
    let askJobText = (body.askJobText ?? '').toString().trim();
    let finalMessage = (body.finalMessage ?? '').toString().trim();

    // Fallback default values
    if (!greetingText) {
      greetingText = 'Assalomu alaykum! Ismingizni kiriting:';
    }
    if (!askPhoneText) {
      askPhoneText =
        'Telefon raqamingizni kiriting (masalan: +99890xxxxxxx):';
    }
    if (!askJobText) {
      askJobText = 'Kasbingiz yoki nima ish qilishingizni yozing:';
    }
    if (!finalMessage) {
      finalMessage =
        "Siz Najot Nurning 21-noyabr kuni bo'lib o'tadigan biznes nonushta suhbat dasturi uchun ro'yhatdan o'tdingiz. Sizga to'liq ma'lumot uchun menejerlarimiz bog'lanishadi.";
    }

    const updated = await prisma.botSettings.upsert({
      where: { id: 1 },
      update: {
        greetingText,
        askPhoneText,
        askJobText,
        finalMessage
      },
      create: {
        greetingText,
        askPhoneText,
        askJobText,
        finalMessage
      }
    });

    return NextResponse.json({
      greetingText: updated.greetingText,
      askPhoneText: updated.askPhoneText,
      askJobText: updated.askJobText,
      finalMessage: updated.finalMessage
    });
  } catch (err) {
    console.error('POST /api/admin/settings error:', err);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}