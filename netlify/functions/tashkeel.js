// Arabic AI Tashkeel via Google Gemini API (free tier)
// Register free at: https://aistudio.google.com/app/apikey
// Add GEMINI_API_KEY to Netlify → Site configuration → Environment variables

const https = require('https');

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const raw = JSON.stringify(body);
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw) }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(raw);
    req.end();
  });
}

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 503, headers: cors, body: JSON.stringify({ error: 'not_configured' }) };
  }

  let text;
  try {
    ({ text } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!text || text.trim().length === 0) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'text required' }) };
  }

  if (text.length > 1500) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'too_long' }) };
  }

  const prompt = `أضف التشكيل الكامل (الحركات) على النص العربي التالي. أرجع النص المُشكَّل فقط بدون أي شرح أو إضافات:\n\n${text.trim()}`;

  try {
    const resp = await httpsPost(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 2048 } }
    );

    if (resp.status !== 200) {
      return { statusCode: 502, headers: cors, body: JSON.stringify({ error: `Gemini error ${resp.status}` }) };
    }

    const data = JSON.parse(resp.body);
    const result = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!result) throw new Error('Empty response from Gemini');

    return { statusCode: 200, headers: cors, body: JSON.stringify({ result }) };
  } catch (err) {
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
