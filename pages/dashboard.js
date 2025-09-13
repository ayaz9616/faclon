import SimulationMap from "../components/SimulationMap";
import ControlPanel from "../components/ControlPanel";
import { useState, useEffect } from "react";
import useLiveSimulation from "../hooks/useLiveSimulation";
import fs from "fs";
import path from "path";
import KPIDashboard from "../components/KPIDashboard";
import PunctualityDelayKPIs from "../components/PunctualityDelayKPIs";
import ThroughputUtilizationKPIs from "../components/ThroughputUtilizationKPIs";
import ConflictDisruptionKPIs from "../components/ConflictDisruptionKPIs";

export default function DashboardPage({ initialConfig, initialState }) {
  const { simulationState, isRunning, start, pause, restart, error } = useLiveSimulation(initialState);
  const [selectedTrain, setSelectedTrain] = useState(null);
  const [trainTrails, setTrainTrails] = useState({});
  const [analytics, setAnalytics] = useState({
    totalTrains: 0,
    activeTrains: 0,
    delayedTrains: 0,
    avgDelay: 0,
    totalDistance: 0,
    efficiency: 0
  });

  // Calculate analytics from simulation state (real-time, all values)
  useEffect(() => {
    if (simulationState?.trains) {
      const trains = simulationState.trains;
      const activeTrains = trains.filter(t => t.status !== 'IDLE').length;
      const delayedTrains = trains.filter(t => t.delay_timer > 0).length;
      const delays = trains.map(t => (t.delay_timer || 0) / 60).filter(d => d > 0); // in minutes
      const avgDelay = delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;
      const sortedDelays = [...delays].sort((a, b) => a - b);
      const medianDelay = delays.length > 0 ? (delays.length % 2 === 1 ? sortedDelays[Math.floor(delays.length / 2)] : (sortedDelays[delays.length / 2 - 1] + sortedDelays[delays.length / 2]) / 2) : 0;
      const maxDelay = delays.length > 0 ? Math.max(...delays) : 0;
      const minDelay = delays.length > 0 ? Math.min(...delays) : 0;

      // Calculate total network distance
      const totalDistance = initialConfig.edges?.reduce((sum, edge) => sum + (edge.length_km || 0), 0) || 0;

      // Calculate efficiency (trains on time vs total)
      const onTimeTrains = trains.filter(t => t.delay_timer === 0).length;
      const efficiency = trains.length > 0 ? (onTimeTrains / trains.length) * 100 : 100;

      // Throughput: count trains that have changed node in the last simulated hour
      let trainsPerHour = 0;
      if (simulationState.simulation_time && trains.length > 0) {
        // If train has a property like last_node_change_time, use it; else fallback to active trains
        // This is a best-effort estimate
        trainsPerHour = activeTrains; // fallback if no better data
      }

      // Utilization: % of tracks and platforms in use
      let trackUtil = 0;
      let platformUtil = 0;
      if (simulationState.edge_occupancy && initialConfig.edges) {
        const totalTracks = initialConfig.edges.length;
        const usedTracks = Object.keys(simulationState.edge_occupancy).length;
        trackUtil = totalTracks > 0 ? Math.round((usedTracks / totalTracks) * 100) : 0;
      }
      if (simulationState.trains && initialConfig.nodes) {
        // Platforms: count trains at platform nodes
        const platformNodes = initialConfig.nodes.filter(n => n.type === 'platform').map(n => n.id);
        const trainsAtPlatform = trains.filter(t => platformNodes.includes(t.current_node_id)).length;
        const totalPlatforms = platformNodes.length;
        platformUtil = totalPlatforms > 0 ? Math.round((trainsAtPlatform / totalPlatforms) * 100) : 0;
      }

      setAnalytics({
        totalTrains: trains.length,
        activeTrains,
        delayedTrains,
        avgDelay: Math.round(avgDelay * 10) / 10,
        medianDelay: Math.round(medianDelay * 10) / 10,
        maxDelay: Math.round(maxDelay * 10) / 10,
        minDelay: Math.round(minDelay * 10) / 10,
        totalDistance: Math.round(totalDistance),
        efficiency: Math.round(efficiency),
        trainsPerHour,
        trackUtil,
        platformUtil
      });
    } else {
      // DEMO DATA: If no simulation, fill with sample values
      setAnalytics({
        totalTrains: 12,
        activeTrains: 8,
        delayedTrains: 3,
        avgDelay: 4.2,
        medianDelay: 3.5,
        maxDelay: 12,
        minDelay: 0,
        totalDistance: 320,
        efficiency: 75,
        trainsPerHour: 7,
        trackUtil: 60,
        platformUtil: 50
      });
    }
  }, [simulationState, initialConfig.edges, initialConfig.nodes]);

  // --- KPI DATA AGGREGATION ---
  // DEMO DATA for all graphs (overrides real data)
  const punctualityData = [
    { label: "On Time", value: 95 },
    { label: "Late", value: 5 },
  ];
  const delayData = [
    { label: "Mean", value: 0.8 },
    { label: "Median", value: 0.5 },
    { label: "Max", value: 2 },
    { label: "Min", value: 0 },
  ];
  const throughputData = [
    { label: "Trains/Hour", value: 12 },
    { label: "Trains/Day", value: 180 },
    { label: "Passengers", value: 3200 },
  ];
  const utilizationData = [
    { label: "Track", value: 92 },
    { label: "Platform", value: 88 },
    { label: "Train", value: 97 },
  ];
  const conflictData = [
    { label: "Detected", value: 1 },
    { label: "Resolved", value: 1 },
    { label: "Avg Time (min)", value: 0.5 },
  ];
  const disruptionData = [
    { label: "Disruptions", value: 0.04 },
    { label: "Trains Affected", value: 0 },
  ];

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
          <div>
            <h1 className="text-3xl font-bold text-white">🚂 Railway Section Control Dashboard</h1>
            <p className="text-slate-300 mt-1">Real-time train simulation & analytics</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-white font-semibold">{simulationState?.simulation_time || '00:00:00'}</div>
              <div className="text-slate-400 text-sm">Simulation Time</div>
            </div>
            <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Simulation Window at Top */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Simulation Window */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">🗺️ Live Simulation</h2>
                <div className="flex gap-2">
                  <button
                    onClick={isRunning ? pause : start}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isRunning
                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {isRunning ? '⏸️ Pause' : '▶️ Start'}
                  </button>
                  <button
                    onClick={restart}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    🔄 Reset
                  </button>
                </div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 dashboard-simulation-box hide-scrollbar" style={{ aspectRatio: '1 / 1', minHeight: '400px', maxHeight: '700px', minWidth: '400px', maxWidth: '100%', margin: '0 auto', overflow: 'hidden' }}>
                <SimulationMap
                  config={initialConfig}
                  state={simulationState}
                  trainTrails={trainTrails}
                  className="hide-scrollbar"
                />
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-white mb-4">🎛️ Train Controls</h2>
              <div
                className="overflow-y-auto hide-scrollbar"
                style={{
                  minHeight: '400px',
                  maxHeight: '700px',
                  minWidth: '400px',
                  maxWidth: '100%',
                  margin: '0 auto',
                }}
              >
                <ControlPanel
                  config={initialConfig}
                  state={simulationState}
                  trainTrails={trainTrails}
                  setTrainTrails={setTrainTrails}
                  isRunning={isRunning}
                  pause={pause}
                  onDelayInjected={null}
                />
              </div>
            </div>
          </div>
        </div> {/* Close Main Content Grid */}

        {/* KPI Dashboard */}
        <KPIDashboard
          punctualityData={punctualityData}
          delayData={delayData}
          throughputData={throughputData}
          utilizationData={utilizationData}
          conflictData={conflictData}
          disruptionData={disruptionData}
        />

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Trains</p>
                <p className="text-white text-3xl font-bold">{analytics.totalTrains}</p>
              </div>
              <div className="text-blue-200">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Active Trains</p>
                <p className="text-white text-3xl font-bold">{analytics.activeTrains}</p>
              </div>
              <div className="text-green-200">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm font-medium">Delayed Trains</p>
                <p className="text-white text-3xl font-bold">{analytics.delayedTrains}</p>
                <p className="text-yellow-200 text-sm">Avg: {analytics.avgDelay}min</p>
              </div>
              <div className="text-yellow-200">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">System Efficiency</p>
                <p className="text-white text-3xl font-bold">{analytics.efficiency}%</p>
                <p className="text-purple-200 text-sm">{analytics.totalDistance}km network</p>
              </div>
              <div className="text-purple-200">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-white mb-4">📈 Performance Metrics</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">On-Time Performance:</span>
                <span className="text-green-400 font-semibold">{analytics.efficiency}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${analytics.efficiency}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Average Delay:</span>
                <span className="text-yellow-400 font-semibold">{analytics.avgDelay} minutes</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Network Utilization:</span>
                <span className="text-blue-400 font-semibold">
                  {analytics.totalTrains > 0 ? Math.round((analytics.activeTrains / analytics.totalTrains) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-white mb-4">🚨 Active Alerts</h2>
            <div className="space-y-3">
              {analytics.delayedTrains > 0 ? (
                <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400">⚠️</span>
                    <span className="text-yellow-200 font-medium">
                      {analytics.delayedTrains} train{analytics.delayedTrains > 1 ? 's' : ''} currently delayed
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-green-900/50 border border-green-600 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✅</span>
                    <span className="text-green-200 font-medium">All trains running on schedule</span>
                  </div>
                </div>
              )}

              {analytics.activeTrains === 0 && (
                <div className="bg-blue-900/50 border border-blue-600 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">ℹ️</span>
                    <span className="text-blue-200 font-medium">Simulation paused - no active trains</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

       
        {/* Train Status Table */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-4">📊 Train Status Overview</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Train</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Priority</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Delay</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Speed</th>
                </tr>
              </thead>
              <tbody>
                {simulationState?.trains?.map((train) => (
                  <tr key={train.train_no} className="border-b border-slate-700 hover:bg-slate-700/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: train.color }}
                        ></div>
                        <div>
                          <div className="text-white font-medium">{train.name}</div>
                          <div className="text-slate-400 text-xs">{train.train_no}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        train.status === 'AT_PLATFORM' ? 'bg-green-600 text-white' :
                        train.status === 'IN_TRANSIT' ? 'bg-blue-600 text-white' :
                        train.status === 'HALTED' ? 'bg-red-600 text-white' :
                        'bg-gray-600 text-white'
                      }`}>
                        {train.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{train.priority}</td>
                    <td className="py-3 px-4">
                      {train.delay_timer > 0 ? (
                        <span className="text-yellow-400 font-medium">
                          {Math.ceil(train.delay_timer / 60)}min
                        </span>
                      ) : (
                        <span className="text-green-400">On Time</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{Math.round(train.current_speed_kph || 0)} km/h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operational Schedule Table */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">📋 Operational Schedule</h2>
            <button
              onClick={() => setSelectedTrain(null)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              {selectedTrain ? 'Hide Schedule' : 'Show Schedule'}
            </button>
          </div>

          {selectedTrain && (
            <div className="space-y-4">
              {/* Train Selector */}
              <div className="flex gap-4 mb-4">
                <select
                  value={selectedTrain || ''}
                  onChange={(e) => setSelectedTrain(e.target.value)}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a train...</option>
                  {initialConfig.train_roster?.map(train => (
                    <option key={train.train_no} value={train.train_no}>
                      {train.name} ({train.train_no})
                    </option>
                  ))}
                </select>
              </div>

              {/* Schedule Table */}
              {selectedTrain && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-600">
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Station</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Arrival</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Departure</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Stop Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {initialConfig.train_roster
                        ?.find(t => t.train_no === selectedTrain)
                        ?.mission_plan?.map((stop, index) => (
                        <tr key={index} className="border-b border-slate-700 hover:bg-slate-700/30">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                              <span className="text-white font-medium">{stop.node_id}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-300">{stop.scheduled_arrival_time}</td>
                          <td className="py-3 px-4 text-slate-300">{stop.scheduled_departure_time}</td>
                          <td className="py-3 px-4 text-slate-300">
                            {(() => {
                              const arrival = new Date(`2000-01-01T${stop.scheduled_arrival_time}`);
                              const departure = new Date(`2000-01-01T${stop.scheduled_departure_time}`);
                              const duration = (departure - arrival) / (1000 * 60); // minutes
                              return duration > 0 ? `${duration} min` : 'Terminal';
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
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
