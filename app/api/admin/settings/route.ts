import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Always ensure there is exactly one settings row
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
      askJobText: settings.askJobText
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

    if (!greetingText) {
      greetingText = 'Assalomu alaykum! Ismingizni kiriting:';
    }
    if (!askPhoneText) {
      askPhoneText =
        'Telefon raqamingizni kiriting (masalan: +99890xxxxxxx):';
    }
    if (!askJobText) {
      askJobText = "Kasbingiz yoki nima ish qilishingizni yozing:";
    }

    const updated = await prisma.botSettings.upsert({
      where: { id: 1 },
      update: {
        greetingText,
        askPhoneText,
        askJobText
      },
      create: {
        greetingText,
        askPhoneText,
        askJobText
      }
    });

    return NextResponse.json({
      greetingText: updated.greetingText,
      askPhoneText: updated.askPhoneText,
      askJobText: updated.askJobText
    });
  } catch (err) {
    console.error('POST /api/admin/settings error:', err);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
