export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { state, disruption, kpis } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  const prompt = `\nYou are an AI assistant for Indian Railways section controllers.\nCurrent state: ${JSON.stringify(state)}\nDisruption: ${JSON.stringify(disruption)}\nKPIs: ${JSON.stringify(kpis)}\nSuggest optimal train precedence, crossings, and actions to maximize throughput and minimize delay. Explain your reasoning.\n  `;
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const data = await response.json();
  res.status(200).json({ result: data.candidates?.[0]?.content?.parts?.[0]?.text || "No recommendation." });
}
