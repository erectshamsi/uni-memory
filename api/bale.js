const { generateAnswer } = require('./chat');

const hami = (q, docs, role) => {
  const u = new URL('/hami', process.env.APP_URL || 'https://uni-memory-assistant.vercel.app');
  u.searchParams.set('q', q);
  u.searchParams.set('role', role || 'همه');
  u.searchParams.set('docs', JSON.stringify((docs || []).map(d => d.id)));
  return u.toString();
};

module.exports = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).send('POST required');

  const secret = process.env.BALE_WEBHOOK_SECRET;
  if (secret && req.headers['x-bale-bot-api-secret-token'] !== secret) {
    return res.status(401).send('unauthorized');
  }

  try {
    const bodyData = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const m = bodyData.message;
    if (!m) return res.status(200).send('ok');

    const token = process.env.BALE_BOT_TOKEN;
    const chat = m.chat?.id;
    const text = (m.text || '').trim();
    if (!token || !chat) return res.status(200).send('ok');

    let payload = {
      chat_id: chat,
      text: 'سلام! پرسش خود را دربارهٔ بخشنامه‌ها و منابع ثبت‌شده بفرستید. ربات فقط به منابع موجود استناد می‌کند.'
    };

    if (text && !text.startsWith('/start')) {
      const result = await generateAnswer(text, 'همه');
      payload = {
        chat_id: chat,
        text:
          result.answer +
          '\n\n' +
          (result.citations.length
            ? '📚 منابع مرتبط:\n' +
              result.citations.map(c => `• ${c.title} (کد: ${c.code || '-'}، وضعیت: ${c.status})\n«${c.quote}»`).join('\n')
            : 'منبع مرتبط یافت نشد.')
      };
      if (result.mode === 'expert') {
        payload.reply_markup = {
          inline_keyboard: [[{ text: '📩 نیازمند پاسخ کارشناس (حامی)', url: hami(text, result.citations, 'همه') }]]
        };
      }
    }

    const api = `https://tapi.bale.ai/bot${token}/sendMessage`;
    await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return res.status(200).send('ok');
  } catch (e) {
    console.error('Bale handler error:', e.message);
    return res.status(200).send('ok');
  }
};
