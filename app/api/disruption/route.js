import simulationEngine from "@/lib/simulationEngine.js";

export async function POST(req) {
  try {
    const { train_no, delay_mins } = await req.json();
    simulationEngine.injectDisruption(train_no, delay_mins);
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to inject disruption", details: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
