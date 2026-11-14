const fs = require('fs');
const path = require('path');

const REPO = process.env.GITHUB_REPO || 'poshtibaniuranus-create/uni-memory-assistant';
const TOKEN = process.env.GITHUB_TOKEN;
const FILE_PATH = 'data/documents.json';

async function getDocs() {
  if (TOKEN && REPO) {
    try {
      const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
      const r = await fetch(url, {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      if (r.ok) {
        const j = await r.json();
        const content = Buffer.from(j.content, 'base64').toString('utf8');
        return JSON.parse(content);
      }
    } catch (e) {
      console.error('GitHub fetch error:', e.message);
    }
  }
  try {
    const localPath = path.join(process.cwd(), 'data', 'documents.json');
    if (fs.existsSync(localPath)) {
      return JSON.parse(fs.readFileSync(localPath, 'utf8'));
    }
  } catch (e) {
    console.error('Local read error:', e.message);
  }
  return [];
}

function getDocText(d) {
  if (typeof d.content === 'string' && d.content.trim()) return d.content;
  if (Array.isArray(d.pages)) return d.pages.map(p => p.text || '').join(' ');
  return '';
}

function getDocCode(d) {
  return d.code || d.doc_code || '';
}

const analytical = /(چرا|تحلیل|تفسیر|استثنا|استثنائ|به نظر شما|آیا می‌توان|آیا میتوان|اگر .{0,40} چه می‌شود|چه می‌شود|مجاز است|تعارض|ابهام|اعتراض|توجیه)/u;

function words(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/u)
    .filter(x => x.length > 1);
}

function searchDocs(q, docs) {
  const qWords = words(q);
  if (!qWords.length) return [];
  return (Array.isArray(docs) ? docs : [])
    .map(d => {
      let score = 0;
      const bodyText = getDocText(d);
      const titleText = `${d.title || ''} ${getDocCode(d)}`;
      const bodySet = new Set(words(bodyText));
      const titleWords = words(titleText);

      for (const w of qWords) {
        if (bodySet.has(w)) score += 1;
        if (titleWords.includes(w)) score += 2;
        if (bodyText.includes(w)) score += 0.5;
      }
      return { doc: d, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(x => x.doc);
}

function formatRefs(docs) {
  return docs.map(d => ({
    id: d.id || 'doc',
    title: d.title || 'بدون عنوان',
    code: getDocCode(d),
    status: d.status || 'approved',
    validity: d.validity || 'valid',
    page: d.pages?.[0]?.page || 1,
    quote: getDocText(d).slice(0, 700)
  }));
}

async function generateAnswer(question, role = 'همه') {
  const docs = await getDocs();
  const found = searchDocs(question, docs);
  const citations = formatRefs(found);

  const hasUnapproved = found.some(
    d => (d.status && d.status !== 'approved') || (d.validity && d.validity !== 'valid')
  );
  const needsExpert = analytical.test(question) || !found.length || hasUnapproved;

  if (needsExpert) {
    return {
      mode: 'expert',
      answer: found.length
        ? 'منابع مرتبط در دسترس‌اند، اما این پرسش نیازمند تفسیر یا بررسی وضعیت منبع است؛ از پاسخ قطعی خودداری می‌شود.'
        : 'منبع تأییدشدهٔ مرتبط در مخزن پیدا نشد؛ برای پاسخ معتبر با کارشناس تماس بگیرید.',
      citations,
      role
    };
  }

  let aiText = '';
  const key = process.env.OPENROUTER_API_KEY;
  if (key) {
    const models = [
      process.env.OPENROUTER_MODEL,
      'google/gemini-2.0-flash-exp:free',
      'qwen/qwen-2.5-72b-instruct:free',
      'qwen/qwen-2.5-7b-instruct:free',
      'meta-llama/llama-3.3-70b-instruct:free'
    ].filter(Boolean);

    for (const model of [...new Set(models)]) {
      try {
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_URL || 'https://vercel.app',
            'X-Title': 'Uni Memory Assistant'
          },
          body: JSON.stringify({
            model,
            temperature: 0.1,
            max_tokens: 500,
            messages: [
              {
                role: 'system',
                content:
                  'به فارسی پاسخ بده. فقط از متن منابع زیر واقعیت نقل کن و هر گزاره را با عنوان یا کد منبع پشتیبانی کن. تحلیل حقوقی/تفسیری، حدس، یا اطلاعات بیرون از منابع ممنوع است. اگر پاسخ عیناً از منابع درنمی‌آید فقط بگو پوشش کافی نیست. نقش پرسشگر: ' +
                  role +
                  '\nمنابع:\n' +
                  citations.map(c => `[${c.code || c.id}] ${c.title}: ${c.quote}`).join('\n')
              },
              { role: 'user', content: question }
            ]
          })
        });
        if (!r.ok) continue;
        const j = await r.json();
        aiText = j.choices?.[0]?.message?.content || '';
        if (aiText) break;
      } catch (e) {
        console.error('OpenRouter error:', e.message);
      }
    }
  }

  if (!aiText) {
    aiText = `بر اساس منبع «${citations[0].title}» (کد: ${citations[0].code || 'ثبت‌شده'}):\n${citations[0].quote}`;
  }

  return { mode: 'facts', answer: aiText, citations, role };
}

module.exports = async function (req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed (POST required)' });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const question = (body.question || '').trim();
    const role = body.role || 'همه';

    if (!question) {
      return res.status(400).json({ error: 'لطفاً پرسش خود را وارد کنید.' });
    }
    if (question.length > 4000) {
      return res.status(413).json({ error: 'حداکثر طول پرسش ۴۰۰۰ نویسه است.' });
    }

    const result = await generateAnswer(question, role);
    return res.status(200).json(result);
  } catch (e) {
    console.error('Chat API Error:', e);
    return res.status(500).json({ error: 'خطای سرور در پردازش پرسش: ' + (e.message || 'Unknown error') });
  }
};
module.exports.generateAnswer = generateAnswer;
