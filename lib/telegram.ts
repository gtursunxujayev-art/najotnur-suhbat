const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.warn('TELEGRAM_BOT_TOKEN is not set');
}

const API_URL = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : '';

export async function sendTelegramMessage(
  chatId: number | string,
  text: string
) {
  if (!TOKEN || !API_URL) {
    console.error('Cannot sendTelegramMessage: TOKEN is missing');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('Telegram sendMessage error:', data);
    }
  } catch (e) {
    console.error('Telegram sendMessage fetch error:', e);
  }
}

export async function sendTelegramPhoto(
  chatId: number | string,
  photoUrl: string,
  caption?: string
) {
  if (!TOKEN || !API_URL) {
    console.error('Cannot sendTelegramPhoto: TOKEN is missing');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption
      })
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('Telegram sendPhoto error:', data);
    }
  } catch (e) {
    console.error('Telegram sendPhoto fetch error:', e);
  }
}

/**
 * Generate QR via external API (no binary headaches)
 * Encodes provided text into QR image URL
 */
export function buildQrUrl(text: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=20&ecc=L&data=${encodeURIComponent(
    text
  )}`;
}
