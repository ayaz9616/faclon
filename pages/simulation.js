import SimulationMap from "../components/SimulationMap";
import ControlPanel from "../components/ControlPanel";
import { useState } from "react";
import useLiveSimulation from "../hooks/useLiveSimulation";
import Link from "next/link";
import fs from "fs";
import path from "path";

export default function SimulationPage({ initialConfig, initialState }) {
  const { simulationState, isRunning, start, pause, restart, error } = useLiveSimulation(initialState);
  const [trainTrails, setTrainTrails] = useState({});

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-red-900 flex items-center justify-center">
        <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg shadow-lg">
          <h2 className="font-bold text-lg mb-2">🚨 System Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              ← Back to Dashboard
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white">🚂 Full Screen Simulation</h1>
              <p className="text-slate-300 mt-1">Immersive train simulation experience</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-white font-semibold text-xl">{simulationState?.simulation_time || '00:00:00'}</div>
              <div className="text-slate-400 text-sm">Simulation Time</div>
            </div>
            <div className={`w-4 h-4 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
          </div>
        </div>
      </div>

      {/* Main Simulation Area */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Control Panel Sidebar */}
        <div className="w-80 bg-slate-800/50 backdrop-blur-sm border-r border-slate-700 p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* Simulation Controls */}
            <div className="bg-slate-700/50 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4">🎮 Simulation Controls</h3>
              <div className="flex flex-col gap-3">
                <button
                  onClick={isRunning ? pause : start}
                  className={`px-6 py-3 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 ${
                    isRunning
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white shadow-yellow-500/25 shadow-lg'
                      : 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/25 shadow-lg'
                  }`}
                >
                  {isRunning ? '⏸️ Pause Simulation' : '▶️ Start Simulation'}
                </button>
                <button
                  onClick={restart}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-blue-500/25 shadow-lg"
                >
                  🔄 Reset Simulation
                </button>
              </div>
            </div>

            {/* Train Controls */}
            <div className="bg-slate-700/50 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4">🚂 Train Management</h3>
              <ControlPanel
                config={initialConfig}
                state={simulationState}
                trainTrails={trainTrails}
                setTrainTrails={setTrainTrails}
                isRunning={isRunning}
                start={start}
                pause={pause}
                restart={restart}
                onDelayInjected={() => {}} // Placeholder for simulation page
              />
            </div>

            {/* Quick Stats */}
            <div className="bg-slate-700/50 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4">📊 Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Active Trains:</span>
                  <span className="text-white font-semibold">
                    {simulationState?.trains?.filter(t => t.status !== 'IDLE').length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Delayed Trains:</span>
                  <span className="text-yellow-400 font-semibold">
                    {simulationState?.trains?.filter(t => t.delay_timer > 0).length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Total Trains:</span>
                  <span className="text-white font-semibold">
                    {simulationState?.trains?.length || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Simulation View */}
        <div className="flex-1 p-6">
          <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 h-full shadow-2xl">
            <div className="h-full rounded-lg overflow-hidden border border-slate-600">
              <SimulationMap
                config={initialConfig}
                state={simulationState}
                trainTrails={trainTrails}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 bg-slate-800/50 backdrop-blur-sm border-t border-slate-700 px-6 py-3">
        <div className="flex justify-between items-center text-sm">
          <div className="text-slate-400">
            Full Screen Simulation Mode • Advanced Railway Control System
          </div>
          <div className="text-slate-400">
            Press F11 for true fullscreen experience
          </div>
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps() {
  const networkPath = path.join(process.cwd(), "public", "config", "network_definition.json");
  const schedulePath = path.join(process.cwd(), "public", "config", "operational_schedule.json");

  let initialConfig = { nodes: [], edges: [], train_roster: [] };
  let initialState = { trains: [] };

  try {
    const networkFile = fs.readFileSync(networkPath, "utf-8");
    const networkJson = JSON.parse(networkFile);
    initialConfig.nodes = networkJson.nodes || [];
    initialConfig.edges = networkJson.edges || [];
  } catch (e) {
    console.error("Failed to load network definition:", e);
  }

  try {
    const scheduleFile = fs.readFileSync(schedulePath, "utf-8");
    const scheduleJson = JSON.parse(scheduleFile);
    initialConfig.train_roster = scheduleJson.train_roster || [];
    initialState = { ...scheduleJson };
  } catch (e) {
    console.error("Failed to load operational schedule:", e);
  }

  return { props: { initialConfig, initialState } };
}
