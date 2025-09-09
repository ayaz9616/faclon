
"use client";
import React from "react";
import useSimulation from "@/hooks/useSimulation";
import SimulationMap from "@/components/SimulationMap";
import ControlPanel from "@/components/ControlPanel";


export default function Home() {
  const { networkConfig, simulationState, isLoading, error, injectDisruption } = useSimulation();
  const [trainTrails, setTrainTrails] = React.useState({});

  // Only reload if error or initializing
  const shouldReload = !!error || (!networkConfig || !simulationState);
  React.useEffect(() => {
    if (shouldReload) {
      const timeout = setTimeout(() => {
        window.location.reload();
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [shouldReload]);

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <img src="https://media.tenor.com/OM89HJPclFwAAAAM/steve-minecraft.gif" alt="train loading" width={500} height={500} style={{ marginBottom: 16 }} />
      <div
        className="mb-2"
        style={{
          fontSize: '2.8rem',
          fontWeight: 900,
          color: 'silver',
          letterSpacing: '0.06em',
          textShadow: '0 0 16px #fff, 0 0 32px #b0c4de, 0 2px 8px #aaa, 0 1px 0 #fff',
          WebkitTextStroke: '1px #e0e0e0',
          filter: 'drop-shadow(0 0 12px #fff) drop-shadow(0 0 24px #b0c4de)'
        }}
      >
        Railway Simulation
      </div>
      <div className="text-lg">Loading map...</div>
    </div>
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800">
        <h1
          style={{
            fontFamily: 'Segoe UI, Arial, sans-serif',
            fontWeight: 900,
            fontSize: '3.5rem',
            letterSpacing: '0.08em',
            color: 'white',
            textShadow: '0 2px 16px #aaa, 0 1px 0 #fff',
          }}
          className="mb-4"
        >
          Railway <span style={{ color: '#C0C0C0', textShadow: '0 2px 16px #fff' }}>Simulation</span>
        </h1>
        <img
          src="https://media.tenor.com/OM89HJPclFwAAAAM/steve-minecraft.gif"
          alt="Steve Minecraft"
          style={{ width: 120, height: 120, borderRadius: 16, marginBottom: 24, boxShadow: '0 4px 32px #222' }}
          className="mb-4"
        />
        <div className="text-lg text-gray-300 mt-2">Initializing....</div>
      </div>
    );
  }

  if (!networkConfig || !simulationState) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
        <img src="https://media.tenor.com/V6HYr1pd1VkAAAAi/train.gif" alt="train loading" width={64} height={64} style={{ marginBottom: 16 }} />
        <div className="text-2xl font-bold mb-2">Railway Simulation</div>
        <div className="text-lg">Initializing...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8 flex flex-row gap-8">
      <div style={{ width: '25%' }}>
        <ControlPanel state={simulationState} onInjectDisruption={injectDisruption} trainTrails={trainTrails} setTrainTrails={setTrainTrails} />
      </div>
      <div style={{ width: '75%' }}>
        <SimulationMap config={networkConfig} state={simulationState} trainTrails={trainTrails} />
      </div>
    </div>
  );
}
