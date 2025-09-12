import fs from 'fs';
import path from 'path';

const NETWORK_CONFIG_PATH = path.join(process.cwd(), 'public', 'config', 'network_definition.json');
const SCHEDULE_CONFIG_PATH = path.join(process.cwd(), 'public', 'config', 'operational_schedule.json');

// --- Utility Functions ---
function timeToSec(t) {
  if (!t || t === "99:99:99") return Infinity;
  const [h, m, s] = t.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

function secToTime(s) {
  const h = Math.floor(s / 3600) % 24;
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function findEdge(network, fromNodeId, toNodeId) {
    return network.edges.find(e => e.start_node_id === fromNodeId && e.end_node_id === toNodeId);
}

// --- Core Simulation Logic ---

class Train {
    constructor(data, networkConfig) {
        this.train_no = data.train_no;
        this.name = data.name;
        this.priority = data.priority;
        this.color = data.color;
        this.route_path = data.route_path;
        this.mission_plan = data.mission_plan;
        this.max_speed_kph = data.max_speed_kph;
        this.networkConfig = networkConfig;

        this.status = 'IDLE'; // IDLE, AT_PLATFORM, IN_TRANSIT
        this.current_node_id = this.route_path[0];
        this.current_edge_id = null;
        this.progress_on_edge = 0;
        this.mission_index = 0;

        // Time-based interpolation state
        this.depart_time_sec = null;
        this.arrival_time_sec = null;
        this.depart_node_id = null;
        this.arrive_node_id = null;
        this.total_segment_distance = 0;
        this.depart_route_index = 0;
        this.arrive_route_index = 0;

        // Initial state check
        const firstMission = this.mission_plan[0];
        if (firstMission && firstMission.node_id === this.current_node_id) {
            this.status = 'AT_PLATFORM';
        }
    }

    update(simTimeSec) {
        const currentMission = this.mission_plan[this.mission_index];
        const nextMission = this.mission_plan[this.mission_index + 1];

        if (this.status === 'AT_PLATFORM') {
            if (currentMission && this.current_node_id === currentMission.node_id) {
                const departureTime = timeToSec(currentMission.scheduled_departure_time);
                if (simTimeSec >= departureTime && nextMission) {
                    this.status = 'IN_TRANSIT';
                    this.depart_time_sec = departureTime; // Use scheduled departure time as the base
                    this.arrival_time_sec = timeToSec(nextMission.scheduled_arrival_time);
                    this.depart_node_id = currentMission.node_id;
                    this.arrive_node_id = nextMission.node_id;
                    
                    this.depart_route_index = this.route_path.indexOf(this.depart_node_id, this.depart_route_index);
                    this.arrive_route_index = this.route_path.indexOf(this.arrive_node_id, this.depart_route_index);

                    this.total_segment_distance = 0;
                    for (let i = this.depart_route_index; i < this.arrive_route_index; i++) {
                        const edge = findEdge(this.networkConfig, this.route_path[i], this.route_path[i + 1]);
                        if (edge) this.total_segment_distance += edge.length_km;
                    }
                    
                    this.progress_on_edge = 0;
                    this.current_edge_id = null;
                }
            }
        } else if (this.status === 'IN_TRANSIT') {
            if (!nextMission || this.depart_time_sec === null) {
                this.status = 'IDLE';
                return;
            }

            const timeFraction = Math.min(1, Math.max(0, (simTimeSec - this.depart_time_sec) / (this.arrival_time_sec - this.depart_time_sec)));
            const distanceAlongSegment = this.total_segment_distance * timeFraction;

            let traversedDistance = 0;
            for (let i = this.depart_route_index; i < this.arrive_route_index; i++) {
                const edge = findEdge(this.networkConfig, this.route_path[i], this.route_path[i + 1]);
                if (!edge) continue;

                if (traversedDistance + edge.length_km >= distanceAlongSegment) {
                    this.current_edge_id = edge.id;
                    this.progress_on_edge = (distanceAlongSegment - traversedDistance) / edge.length_km;
                    this.current_node_id = this.route_path[i];
                    break;
                }
                traversedDistance += edge.length_km;
            }

            if (timeFraction >= 1) {
                this.status = 'AT_PLATFORM';
                this.current_node_id = this.arrive_node_id;
                this.current_edge_id = null;
                this.progress_on_edge = 0;
                this.mission_index++;
            }
        }
    }

    getState() {
        return {
            train_no: this.train_no,
            name: this.name,
            color: this.color,
            status: this.status,
            current_node_id: this.current_node_id,
            current_edge_id: this.current_edge_id,
            progress_on_edge: this.progress_on_edge,
            priority: this.priority,
        };
    }
}

class SimulationEngine {
    constructor() {
        console.log("Initializing Simulation Engine...");
        this.loadConfig();
        this.simulationTime = this.scheduleConfig.simulation_parameters?.start_time || '08:00:00';
        this.timeScaleFactor = this.scheduleConfig.simulation_parameters?.time_scale_factor || 360;
        this.tickIntervalMs = 1000;
        this.trains = [];
        this.paused = true;
        this.initTrains();
        this.startLoop();
        console.log("Simulation Engine started.");
    }

    loadConfig() {
        try {
            this.networkConfig = JSON.parse(fs.readFileSync(NETWORK_CONFIG_PATH, 'utf-8'));
            this.scheduleConfig = JSON.parse(fs.readFileSync(SCHEDULE_CONFIG_PATH, 'utf-8'));
        } catch (error) {
            console.error("Failed to load simulation config:", error);
            this.networkConfig = { nodes: [], edges: [] };
            this.scheduleConfig = { simulation_parameters: {}, train_roster: [] };
        }
    }

    initTrains() {
        this.trains = this.scheduleConfig.train_roster.map(trainData => new Train(trainData, this.networkConfig));
    }

    startLoop() {
        setInterval(() => this.tick(), this.tickIntervalMs);
    }

    tick() {
        if (this.paused) return;
        
        let simTimeSec = timeToSec(this.simulationTime);
        simTimeSec += (this.tickIntervalMs / 1000) * this.timeScaleFactor;
        this.simulationTime = secToTime(simTimeSec);

        const simTimeSecForUpdate = timeToSec(this.simulationTime);
        for (const train of this.trains) {
            train.update(simTimeSecForUpdate);
        }
    }

    restart() {
        this.loadConfig();
        this.simulationTime = this.scheduleConfig.simulation_parameters?.start_time || '08:00:00';
        this.initTrains();
        this.setPaused(true); // Ensure simulation is paused after restart
        console.log("Simulation restarted and paused.");
    }

    setPaused(paused) {
        this.paused = paused;
        console.log(this.paused ? "Simulation paused." : "Simulation resumed.");
    }

    getState() {
        return {
            simulationTime: this.simulationTime,
            trains: this.trains.map(train => train.getState()),
        };
    }
}

// Singleton pattern for Next.js server environment
const globalForEngine = global;
if (!globalForEngine.simulationEngine) {
    globalForEngine.simulationEngine = new SimulationEngine();
}
const engine = globalForEngine.simulationEngine;


export default function handler(req, res) {
    if (req.method === 'POST') {
        const { action } = req.body;
        if (action === 'start') {
            engine.setPaused(false);
        } else if (action === 'pause') {
            engine.setPaused(true);
        } else if (action === 'restart') {
            engine.restart();
        }
        res.status(200).json(engine.getState());
    } else if (req.method === 'GET') {
        res.status(200).json(engine.getState());
    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
