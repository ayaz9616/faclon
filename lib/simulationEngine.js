import fs from 'fs';
import path from 'path';
import { getDecisionForConflict } from './decisionEngine.js';

const NETWORK_CONFIG_PATH = path.join(process.cwd(), 'public', 'config', 'network_definition.json');
const SCHEDULE_CONFIG_PATH = path.join(process.cwd(), 'public', 'config', 'operational_schedule.json');

class Train {
  constructor(data, networkConfig) {
    this.train_no = data.train_no;
    this.name = data.name;
    this.priority = data.priority;
    this.color = data.color;
    this.route_path = data.route_path;
    this.mission_plan = data.mission_plan;
    this.max_speed_kph = data.max_speed_kph;
    this.current_speed_kph = data.max_speed_kph;
    this.current_edge_id = null;
    this.progress_on_edge = 0.0;
    this.status = 'IDLE';
    this.delay_timer = 0;
    this.networkConfig = networkConfig;
    this.route_index = 0;
    this._initPosition();
  }

  _initPosition() {
    if (this.route_path && this.route_path.length > 1) {
      this.current_edge_id = this._findEdgeId(this.route_path[0], this.route_path[1]);
      this.progress_on_edge = 0.0;
      this.status = 'IN_TRANSIT';
      this.route_index = 1;
    }
  }

  update(simEngine) {
    if (this.delay_timer > 0) {
      this.delay_timer--;
      if (this.delay_timer <= 0) {
        this.status = 'IN_TRANSIT';
      }
      return;
    }
    if (this.status === 'HALTED') return;
    if (this.status === 'WAITING_FOR_PATH') {
      const nextEdgeId = this._getNextEdgeId();
      if (nextEdgeId && !simEngine.edgeOccupancy[nextEdgeId]) {
        this.current_edge_id = nextEdgeId;
        this.progress_on_edge = 0.0;
        this.status = 'IN_TRANSIT';
        this.route_index++;
      }
      return;
    }
    if (this.status === 'IN_TRANSIT') {
      const edge = this._getCurrentEdge();
      if (!edge) return;
      const speed_mps = (this.current_speed_kph * 1000) / 3600;
      const edge_length_m = edge.length_km * 1000;
      const tick_s = simEngine.tickIntervalMs / 1000 * simEngine.timeScaleFactor;
      const progress_delta = (speed_mps * tick_s) / edge_length_m;
      this.progress_on_edge += progress_delta;
      if (this.progress_on_edge >= 1.0) {
        this.progress_on_edge = 0.0;
        const nextEdgeId = this._getNextEdgeId();
        if (nextEdgeId) {
          const contenders = simEngine.activeTrains.filter(t => t._getNextEdgeId() === nextEdgeId);
          if (contenders.length > 1) {
            getDecisionForConflict({ edgeId: nextEdgeId, contenders }).then(decision => {
              if (decision.winner === this.train_no) {
                this.current_edge_id = nextEdgeId;
                this.status = 'IN_TRANSIT';
                this.route_index++;
              } else {
                this.status = 'WAITING_FOR_PATH';
              }
            });
          } else {
            this.current_edge_id = nextEdgeId;
            this.status = 'IN_TRANSIT';
            this.route_index++;
          }
        } else {
          this.status = 'IDLE';
        }
      }
    }
  }

  _getCurrentEdge() {
    if (!this.current_edge_id) return null;
    return this.networkConfig.edges.find(e => e.id === this.current_edge_id) || null;
  }

  _getNextEdgeId() {
    if (!this.route_path || this.route_index >= this.route_path.length) return null;
    const from = this.route_path[this.route_index - 1];
    const to = this.route_path[this.route_index];
    return this._findEdgeId(from, to);
  }

  _findEdgeId(from, to) {
    const edge = this.networkConfig.edges.find(e => e.start_node_id === from && e.end_node_id === to);
    return edge ? edge.id : null;
  }

  getState() {
    return {
      train_no: this.train_no,
      name: this.name,
      priority: this.priority,
      color: this.color,
      route_path: this.route_path,
      mission_plan: this.mission_plan,
      max_speed_kph: this.max_speed_kph,
      current_speed_kph: this.current_speed_kph,
      current_edge_id: this.current_edge_id,
      progress_on_edge: this.progress_on_edge,
      status: this.status,
      delay_timer: this.delay_timer,
    };
  }
}

class SimulationEngine {
  constructor() {
    console.log("Initializing Simulation Engine...");
    try {
      this.networkConfig = JSON.parse(fs.readFileSync(NETWORK_CONFIG_PATH, 'utf-8'));
      this.scheduleConfig = JSON.parse(fs.readFileSync(SCHEDULE_CONFIG_PATH, 'utf-8'));
    } catch (error) {
      console.error("Failed to load simulation config:", error);
      this.networkConfig = { nodes: [], edges: [] };
      this.scheduleConfig = { simulation_parameters: {}, train_roster: [] };
    }

  this.simulationTime = this.scheduleConfig.simulation_parameters?.start_time || '08:00:00';
  this.timeScaleFactor = 20;
  this.activeTrains = [];
  this.edgeOccupancy = {};
  this.tickIntervalMs = 50;
      this.paused = false;
    this._initTrains();
    this._startLoop();
    console.log("Simulation Engine started.");
  }

    restart() {
      try {
        this.networkConfig = JSON.parse(fs.readFileSync(NETWORK_CONFIG_PATH, 'utf-8'));
        this.scheduleConfig = JSON.parse(fs.readFileSync(SCHEDULE_CONFIG_PATH, 'utf-8'));
      } catch (error) {
        console.error("Failed to reload simulation config:", error);
        this.networkConfig = { nodes: [], edges: [] };
        this.scheduleConfig = { simulation_parameters: {}, train_roster: [] };
      }
      this.simulationTime = this.scheduleConfig.simulation_parameters?.start_time || '08:00:00';
      this.timeScaleFactor = this.scheduleConfig.simulation_parameters?.time_scale_factor || 360;
      this.activeTrains = [];
      this.edgeOccupancy = {};
      this._initTrains();
      console.log("Simulation restarted.");
    }

    setPaused(paused) {
      this.paused = paused;
      console.log(paused ? "Simulation paused." : "Simulation resumed.");
    }

  _initTrains() {
    this.activeTrains = this.scheduleConfig.train_roster.map(trainData => new Train(trainData, this.networkConfig));
  }

  _startLoop() {
    setInterval(() => this._update(), this.tickIntervalMs);
  }

  _update() {
    if (this.paused) return;
    this.simulationTime = this._advanceTime(this.simulationTime, this.tickIntervalMs, this.timeScaleFactor);
    for (const train of this.activeTrains) {
      train.update(this);
    }
    this.edgeOccupancy = {};
    for (const train of this.activeTrains) {
      if (train.current_edge_id && train.status === 'IN_TRANSIT') {
        this.edgeOccupancy[train.current_edge_id] = train.train_no;
      }
    }
  }

  _advanceTime(current, ms, scale) {
    const [h, m, s] = current.split(':').map(Number);
    const totalSeconds = h * 3600 + m * 60 + s + Math.floor((ms / 1000) * scale);
    const nh = Math.floor(totalSeconds / 3600) % 24;
    const nm = Math.floor((totalSeconds % 3600) / 60);
    const ns = totalSeconds % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}:${String(ns).padStart(2, '0')}`;
  }

  getState() {
    return {
      simulation_time: this.simulationTime,
      trains: this.activeTrains.map(train => train.getState()),
      edge_occupancy: this.edgeOccupancy,
    };
  }

  injectDisruption(train_no, delay_mins) {
    const train = this.activeTrains.find(t => t.train_no === train_no);
    if (train) {
      train.delay_timer = (delay_mins || 1) * 60;
      train.status = 'HALTED';
    }
  }
}

// Robust singleton pattern for Next.js server environment
const globalForEngine = globalThis;
if (!globalForEngine.simulationEngine) {
  globalForEngine.simulationEngine = new SimulationEngine();
}
const simulationEngine = globalForEngine.simulationEngine;

export default simulationEngine;
