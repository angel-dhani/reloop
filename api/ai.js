// Vercel serverless function using Google Gemini (free tier). Key stays on the server.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const { kind, text = '', image, history = '' } = req.body || {};
  const q = String(text).slice(0, 500);

  const parts = [];
  let json = false;
  if (kind === 'scan') {
    json = true;
    const m = image && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(image);
    if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
    parts.push({ text: `You are ReLoop, a household waste agent for an Indian city (wet/dry/e-waste/hazardous bins, kabadiwala and municipal e-waste collection). The user is about to throw away: "${q || '(see photo)'}". Choose the BEST destination, not just the bin. Reply ONLY with JSON: {"item":str,"material":str,"destination":"compost|recycle|reuse|ewaste|hazard|landfill","prep":[max 3 short steps],"upcycle":"one creative reuse idea","co2_saved_g":number,"why":"one sentence","confidence":0-1}` });
  } else if (kind === 'coach') {
    parts.push({ text: `You are ReLoop's friendly waste coach for an Indian household. The user has sorted: ${String(history).slice(0, 500)}. Answer in under 70 words, practical and specific. Question: ${q}` });
  } else return res.status(400).json({ error: 'Bad kind' });

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
           generationConfig: Object.assign({ maxOutputTokens: 800 },
          json ? { responseMimeType: 'application/json' } : {})
      })
    });
    const d = await r.json();
    if (!r.ok) return res.status(502).json({ error: (d.error && d.error.message) || 'Upstream error' });
    const out = ((((d.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('').trim();
    if (!json) return res.json({ text: out });
    return res.json(JSON.parse(out.replace(/```json|```/g, '').trim()));
  } catch (e) {
    return res.status(500).json({ error: 'Failed' });
  }
};
