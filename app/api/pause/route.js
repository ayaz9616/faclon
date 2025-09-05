import simulationEngine from '@/lib/simulationEngine.js';

export async function POST(request) {
  const { paused } = await request.json();
  simulationEngine.setPaused(!!paused);
  return new Response(JSON.stringify({ status: 'ok', paused }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
