import simulationEngine from '@/lib/simulationEngine.js';

export async function POST() {
  simulationEngine.restart();
  return new Response(JSON.stringify({ status: 'ok', message: 'Simulation restarted.' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
