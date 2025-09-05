
"use client";
import React from "react";
import useSimulation from "@/hooks/useSimulation";
import SimulationMap from "@/components/SimulationMap";
import ControlPanel from "@/components/ControlPanel";

export default function Home() {
  const { networkConfig, simulationState, isLoading, error, injectDisruption } = useSimulation();
  const [showTrails, setShowTrails] = React.useState(true);

  if (isLoading) return <div className="flex items-center justify-center h-screen text-white text-2xl">Loading simulation...</div>;
  if (error) return <div className="flex items-center justify-center h-screen text-red-500 text-2xl">Error: {error.message}</div>;
  if (!networkConfig || !simulationState) return <div className="flex items-center justify-center h-screen text-white text-2xl">Initializing...</div>;

  return (
    <div className="min-h-screen bg-gray-950 p-8 flex flex-row gap-8">
      <div style={{ width: '25%' }}>
        <ControlPanel state={simulationState} onInjectDisruption={injectDisruption} showTrails={showTrails} setShowTrails={setShowTrails} />
      </div>
      <div style={{ width: '75%' }}>
        <SimulationMap config={networkConfig} state={simulationState} showTrails={showTrails} />
      </div>
    </div>
  );
}
