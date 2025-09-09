import fs from 'fs';
import path from 'path';
import { getDecisionForConflict } from './decisionEngine.js';

const NETWORK_CONFIG_PATH = path.join(process.cwd(), 'public', 'config', 'network_definition.json');
const SCHEDULE_CONFIG_PATH = path.join(process.cwd(), 'public', 'config', 'operational_schedule.json');

class Train {
  constructor(data, networkConfig, simEngine) {
    this.train_no = data.train_no;
    this.name = data.name;
    this.priority = data.priority;
    this.color = data.color;
    this.route_path = data.route_path; // The full path, including intermediate nodes
    this.mission_plan = data.mission_plan; // Key stops with schedules
    this.max_speed_kph = data.max_speed_kph;
    
    this.current_speed_kph = 0;
    this.current_node_id = null;
    this.current_edge_id = null;
    this.progress_on_edge = 0.0;
    this.status = 'IDLE'; // IDLE, AT_PLATFORM, IN_TRANSIT, HALTED
    
    this.delay_timer = 0;
    this.networkConfig = networkConfig;
    this.mission_index = 0; // Which mission objective we are currently fulfilling or heading towards
    this.route_index = 0;   // The index of the node we are at in the route_path
    
    this._initPosition(simEngine);
  }

  _initPosition(simEngine) {
    if (this.route_path && this.route_path.length > 0) {
      this.current_node_id = this.route_path[0];
      this.route_index = 0;
      // Check if the starting node is a mission stop
      const firstMission = this.mission_plan[0];
      if (firstMission && firstMission.node_id === this.current_node_id) {
        this.status = 'AT_PLATFORM';
        this.mission_index = 0;
      } else {
        // If not starting at a mission stop, immediately start moving.
        this.status = 'IN_TRANSIT';
        this._departToNextNode(simEngine);
      }
    }
  }

  timeToSec(t) {
    if (!t || t === "99:99:99") return Infinity;
    const [h, m, s] = t.split(":").map(Number);
    return h * 3600 + m * 60 + s;
  }

  update(simEngine) {
    const simTimeSec = this.timeToSec(simEngine.simulationTime);
    // DEBUG: Log current state
    // console.log(`[Train ${this.train_no}] status=${this.status} node=${this.current_node_id} mission_index=${this.mission_index} simTime=${simEngine.simulationTime}`);

    if (this.delay_timer > 0) {
      this.delay_timer -= 1;
      if (this.delay_timer <= 0) {
        this.status = this.current_edge_id ? 'IN_TRANSIT' : 'AT_PLATFORM';
      }
      return;
    }
    if (this.status === 'HALTED') return;

    // --- Main State Machine ---
    // If at a mission stop, wait for scheduled departure
    const currentMission = this.mission_plan[this.mission_index];
    const nextMission = this.mission_plan[this.mission_index + 1];

    if (this.status === 'AT_PLATFORM') {
      if (currentMission && this.current_node_id === currentMission.node_id) {
        const departureTime = this.timeToSec(currentMission.scheduled_departure_time);
        if (simTimeSec >= departureTime && nextMission) {
          // Depart to next mission node
          this.status = 'IN_TRANSIT';
          this.depart_time_sec = simTimeSec;
          this.arrival_time_sec = this.timeToSec(nextMission.scheduled_arrival_time);
          this.depart_node_id = currentMission.node_id;
          this.arrive_node_id = nextMission.node_id;
          this.depart_route_index = this.route_path.indexOf(this.depart_node_id, this.route_index);
          this.arrive_route_index = this.route_path.indexOf(this.arrive_node_id, this.depart_route_index);
          this.total_segment_distance = 0;
          for (let i = this.depart_route_index; i < this.arrive_route_index; i++) {
            const edge = this._findEdge(this.route_path[i], this.route_path[i+1]);
            if (edge) this.total_segment_distance += edge.length_km;
          }
          this.progress_on_edge = 0;
          this.current_edge_id = null;
          this.route_index = this.depart_route_index;
        }
      }
    } else if (this.status === 'IN_TRANSIT') {
      // Interpolate position between depart_node_id and arrive_node_id based on time
      if (!nextMission) {
        // No more missions, stop
        this.status = 'IDLE';
        return;
      }
      const t0 = this.depart_time_sec;
      const t1 = this.arrival_time_sec;
      const frac = Math.min(1, Math.max(0, (simTimeSec - t0) / (t1 - t0)));
      // Find which edge we are on
      let distAlong = this.total_segment_distance * frac;
      let traversed = 0;
      for (let i = this.depart_route_index; i < this.arrive_route_index; i++) {
        const edge = this._findEdge(this.route_path[i], this.route_path[i+1]);
        if (!edge) break;
        if (traversed + edge.length_km >= distAlong) {
          this.current_edge_id = edge.id;
          this.progress_on_edge = (distAlong - traversed) / edge.length_km;
          this.current_node_id = this.route_path[i];
          this.route_index = i;
          break;
        }
        traversed += edge.length_km;
      }
      // If arrived at next mission node
      if (frac >= 1) {
        this.status = 'AT_PLATFORM';
        this.current_node_id = this.arrive_node_id;
        this.route_index = this.arrive_route_index;
        this.current_edge_id = null;
        this.progress_on_edge = 0;
        this.mission_index++;
      }
    }
  }

  _departToNextNode(simEngine) {
    if (this.route_index + 1 >= this.route_path.length) {
      this.status = 'IDLE'; // End of the line
      this.current_speed_kph = 0;
      return;
    }
    
    const nextNodeInPath = this.route_path[this.route_index + 1];
    const edge = this._findEdge(this.current_node_id, nextNodeInPath);

    if (edge) {
      this.current_edge_id = edge.id;
      this.progress_on_edge = 0;
      this.status = 'IN_TRANSIT';
      
      // Set speed based on the next *mission* stop, not the next node in the path
      const nextMission = this.mission_plan[this.mission_index];
      
    if (nextMission) {
      const departureNode = this.mission_plan[this.mission_index - 1];
      const departureTime = this.timeToSec(departureNode?.scheduled_departure_time || simEngine.simulationTime);
      const arrivalTime = this.timeToSec(nextMission.scheduled_arrival_time);
      const travelTimeSec = arrivalTime - departureTime;
      const segmentDistanceKm = this._getDistanceToNextMissionNode();
      if (travelTimeSec > 0 && segmentDistanceKm > 0) {
        const requiredSpeedKph = (segmentDistanceKm / travelTimeSec) * 3600;
        this.current_speed_kph = Math.min(requiredSpeedKph, this.max_speed_kph);
      } else {
        this.current_speed_kph = this.max_speed_kph;
      }
      // DEBUG: Log speed calculation
      console.log(`[Train ${this.train_no}] Departing to ${nextNodeInPath} at speed ${this.current_speed_kph} kph, segmentDistanceKm=${segmentDistanceKm}, travelTimeSec=${travelTimeSec}`);
      } else {
          // No next mission, just go max speed to the end of the route
          this.current_speed_kph = this.max_speed_kph;
          console.log(`[Train ${this.train_no}] Departing to ${nextNodeInPath} at max speed (no next mission)`);
      }
    } else {
        console.error(`Train ${this.train_no} could not find edge from ${this.current_node_id} to ${nextNodeInPath}`);
        this.status = 'IDLE';
    }
  }

  _getDistanceToNextMissionNode() {
    const nextMission = this.mission_plan[this.mission_index];
    if (!nextMission) return 0;

    const nextMissionNodeIndexInRoute = this.route_path.indexOf(nextMission.node_id, this.route_index);
    if (nextMissionNodeIndexInRoute === -1) return 0;

    let totalDistance = 0;
    for (let i = this.route_index; i < nextMissionNodeIndexInRoute; i++) {
      const edge = this._findEdge(this.route_path[i], this.route_path[i+1]);
      if (edge) {
        totalDistance += edge.length_km;
      } else {
        // This case should be handled gracefully, maybe return 0 or throw an error
        console.error(`Could not find edge for distance calculation: from ${this.route_path[i]} to ${this.route_path[i+1]}`);
        return 0;
      }
    }
    return totalDistance;
  }

  _getCurrentEdge() {
    if (!this.current_edge_id) return null;
    return this.networkConfig.edges.find(e => e.id === this.current_edge_id);
  }

  _findEdge(from, to) {
    return this.networkConfig.edges.find(e => e.start_node_id === from && e.end_node_id === to);
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
      current_node_id: this.current_node_id,
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
    this.timeScaleFactor = this.scheduleConfig.simulation_parameters?.time_scale_factor || 360;
  this.activeTrains = [];
  this.edgeOccupancy = {};
  this.tickIntervalMs = 1000;
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
    this.activeTrains = this.scheduleConfig.train_roster.map(trainData => new Train(trainData, this.networkConfig, this));
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
