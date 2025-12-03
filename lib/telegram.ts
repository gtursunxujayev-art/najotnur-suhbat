export async function sendTelegramMessage(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not set');
    return;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text
        })
      }
    );

    if (!res.ok) {
      const body = await res.text();
      console.error('sendTelegramMessage failed', res.status, body);
    }
  } catch (err) {
    console.error('sendTelegramMessage error', err);
  }
}