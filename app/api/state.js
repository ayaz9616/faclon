import simulationEngine from "@/lib/simulationEngine.js";

export async function GET() {
  try {
    const state = simulationEngine.getState();
    return new Response(JSON.stringify(state), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Simulation state not available", details: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
