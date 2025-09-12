import simulationEngine from '@/lib/simulationEngine.js';
import fs from 'fs';
import path from 'path';

// Configuration constants
const MIN_HEADWAY_MINUTES = 3; // Minimum time between trains on same segment
const PLATFORM_OCCUPANCY_MINUTES = 2; // Time needed to clear platform
const CASCADE_BUFFER_MINUTES = 1; // Extra buffer for cascade effects

// Load configuration files
const NETWORK_CONFIG_PATH = path.join(process.cwd(), 'public', 'config', 'network_definition.json');
const SCHEDULE_CONFIG_PATH = path.join(process.cwd(), 'public', 'config', 'operational_schedule.json');

function loadNetworkConfig() {
  try {
    return JSON.parse(fs.readFileSync(NETWORK_CONFIG_PATH, 'utf-8'));
  } catch (error) {
    console.error('Failed to load network config:', error);
    return { nodes: [], edges: [] };
  }
}

function loadScheduleConfig() {
  try {
    return JSON.parse(fs.readFileSync(SCHEDULE_CONFIG_PATH, 'utf-8'));
  } catch (error) {
    console.error('Failed to load schedule config:', error);
    return { train_roster: [] };
  }
}

function saveScheduleConfig(config) {
  try {
    fs.writeFileSync(SCHEDULE_CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log('Schedule config updated successfully');
  } catch (error) {
    console.error('Failed to save schedule config:', error);
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { trainId, delayMinutes, mode = "preview" } = body;
    console.log(`=== RULE-BASED CONFLICT RESOLUTION (${mode}) ===`);
    console.log(`Processing delay for train ${trainId}: ${delayMinutes} minutes`);

    if (!trainId || !delayMinutes) {
      return new Response(JSON.stringify({
        success: false,
        message: "Missing required parameters: trainId and delayMinutes"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Load configurations
    const networkConfig = loadNetworkConfig();
    const scheduleConfig = loadScheduleConfig();
    const simState = simulationEngine.getState();

    // Find the affected train
    const affectedTrain = scheduleConfig.train_roster.find(train => train.train_no === trainId);
    if (!affectedTrain) {
      console.log(`Train ${trainId} not found in schedule`);
      return new Response(JSON.stringify({
        success: false,
        message: `Train ${trainId} not found in schedule`
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Found affected train: ${affectedTrain.name} (${affectedTrain.train_no})`);

    // Apply rule-based conflict resolution
    const resolution = resolveConflictsWithRules(
      scheduleConfig,
      networkConfig,
      simState,
      trainId,
      delayMinutes
    );

    if (mode === "preview") {
      // Return the proposed changes and updated schedule, do NOT apply
      return new Response(JSON.stringify({
        success: true,
        message: `Preview of delay for ${trainId}`,
        affected_train: trainId,
        delay_minutes: delayMinutes,
        changes: resolution.changes,
        updatedSchedule: resolution.updatedSchedule,
        conflictsDetected: resolution.conflictsDetected,
        resolution_method: "rule-based"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else if (mode === "commit") {
      // Apply the resolved schedule
      saveScheduleConfig(resolution.updatedSchedule);

      // Small delay to ensure file write completes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if simulation was running before restart
      const wasRunning = !simulationEngine.paused;
      console.log(`Simulation was ${wasRunning ? 'running' : 'paused'} before restart`);

      // Restart simulation with updated schedule
      if (typeof simulationEngine.restart === 'function') {
        simulationEngine.restart();
        console.log('Simulation restarted with updated schedule');

        // If simulation was running before, resume it to show rerouting
        if (wasRunning) {
          simulationEngine.setPaused(false);
          console.log('Simulation resumed to show rerouting behavior');
        }
      }

      console.log(`Resolution complete: ${resolution.changes.length} changes applied`);

      return new Response(JSON.stringify({
        success: true,
        message: `Delay of ${delayMinutes} minutes applied with rule-based resolution`,
        affected_train: trainId,
        delay_minutes: delayMinutes,
        changes_applied: resolution.changes.length,
        trains_modified: [...new Set(resolution.changes.map(c => c.trainId))].length,
        resolution_method: "rule-based"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        message: "Invalid mode. Use 'preview' or 'commit'"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error('Error in rule-based conflict resolution:', error);
    return new Response(JSON.stringify({
      success: false,
      message: "Failed to resolve conflicts",
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Rule-based conflict resolution system
function resolveConflictsWithRules(scheduleConfig, networkConfig, simState, delayedTrainId, delayMinutes) {
  console.log(`Applying ${delayMinutes} minute delay to train ${delayedTrainId}`);

  const updatedSchedule = JSON.parse(JSON.stringify(scheduleConfig)); // Deep copy
  const changes = [];

  // Step 1: Apply initial delay to the affected train
  const affectedTrainIndex = updatedSchedule.train_roster.findIndex(t => t.train_no === delayedTrainId);
  if (affectedTrainIndex === -1) {
    throw new Error(`Train ${delayedTrainId} not found in schedule`);
  }

  const affectedTrain = updatedSchedule.train_roster[affectedTrainIndex];
  console.log(`Applying delay to ${affectedTrain.name} (${affectedTrain.train_no})`);

  // Apply delay to all stops of the affected train
  affectedTrain.mission_plan.forEach((stop, index) => {
    const originalArrival = stop.scheduled_arrival_time;
    const originalDeparture = stop.scheduled_departure_time;

    stop.scheduled_arrival_time = addMinutesToTime(originalArrival, delayMinutes);
    stop.scheduled_departure_time = addMinutesToTime(originalDeparture, delayMinutes);

    changes.push({
      trainId: delayedTrainId,
      stopIndex: index,
      originalArrival,
      originalDeparture,
      newArrival: stop.scheduled_arrival_time,
      newDeparture: stop.scheduled_departure_time,
      reason: "Initial delay application"
    });
  });

  // Step 2: Detect and resolve conflicts with other trains
  const conflicts = detectPotentialConflicts(updatedSchedule, networkConfig, delayedTrainId);

  console.log(`Detected ${conflicts.length} potential conflicts`);

  // Step 3: Apply conflict resolution rules
  conflicts.forEach(conflict => {
    const resolution = resolveConflict(updatedSchedule, conflict, changes);
    if (resolution) {
      changes.push(...resolution);
    }
  });

  console.log(`Applied ${changes.length} total changes`);

  return {
    updatedSchedule,
    changes,
    conflictsDetected: conflicts.length
  };
}

// Detect potential conflicts between trains
function detectPotentialConflicts(scheduleConfig, networkConfig, delayedTrainId) {
  const conflicts = [];
  const delayedTrain = scheduleConfig.train_roster.find(t => t.train_no === delayedTrainId);

  if (!delayedTrain) return conflicts;

  // Check each other train for potential conflicts
  scheduleConfig.train_roster.forEach(otherTrain => {
    if (otherTrain.train_no === delayedTrainId) return;

    const conflict = checkTrainConflict(delayedTrain, otherTrain, networkConfig);
    if (conflict) {
      conflicts.push({
        train1: delayedTrain,
        train2: otherTrain,
        ...conflict
      });
    }
  });

  return conflicts;
}

// Check if two trains have a conflict
function checkTrainConflict(train1, train2, networkConfig) {
  // Find overlapping segments in routes
  const overlappingSegments = findOverlappingSegments(train1.route_path, train2.route_path);

  if (overlappingSegments.length === 0) {
    return null; // No route overlap
  }

  // Check timing conflicts at overlapping segments
  for (const segment of overlappingSegments) {
    const timingConflict = checkTimingConflict(train1, train2, segment);
    if (timingConflict) {
      return {
        segment,
        type: timingConflict.type,
        time: timingConflict.time,
        severity: timingConflict.severity
      };
    }
  }

  return null;
}

// Check for timing conflicts between two trains at a specific segment
function checkTimingConflict(train1, train2, segment) {
  const [node1, node2] = segment.split('-');

  // Find the mission stops for this segment
  const stop1 = train1.mission_plan.find(stop => stop.node_id === node2);
  const stop2 = train2.mission_plan.find(stop => stop.node_id === node2);

  if (!stop1 || !stop2) return null;

  const time1 = timeToMinutes(stop1.scheduled_arrival_time);
  const time2 = timeToMinutes(stop2.scheduled_arrival_time);

  const timeDiff = Math.abs(time1 - time2);

  // Check for conflicts based on minimum headway
  if (timeDiff < MIN_HEADWAY_MINUTES) {
    return {
      type: 'headway_violation',
      time: Math.min(time1, time2),
      severity: timeDiff < 1 ? 'critical' : 'moderate'
    };
  }

  // Check for platform conflicts (same arrival time)
  if (timeDiff === 0) {
    return {
      type: 'platform_conflict',
      time: time1,
      severity: 'critical'
    };
  }

  return null;
}

// Resolve a detected conflict using rules
function resolveConflict(scheduleConfig, conflict, changes) {
  const { train1, train2, segment, type, severity } = conflict;

  console.log(`Resolving ${type} conflict between ${train1.train_no} and ${train2.train_no} at ${segment}`);

  // Rule 1: Priority-based resolution
  // Higher priority train gets preference
  const higherPriorityTrain = train1.priority >= train2.priority ? train1 : train2;
  const lowerPriorityTrain = train1.priority < train2.priority ? train1 : train2;

  // Rule 2: Apply delay to lower priority train
  const delayAmount = severity === 'critical' ? MIN_HEADWAY_MINUTES + CASCADE_BUFFER_MINUTES :
                     severity === 'moderate' ? MIN_HEADWAY_MINUTES : CASCADE_BUFFER_MINUTES;

  // Find the affected stop
  const [_, node2] = segment.split('-');
  const stopIndex = lowerPriorityTrain.mission_plan.findIndex(stop => stop.node_id === node2);

  if (stopIndex === -1) return null;

  // Apply delay to subsequent stops
  const resolutionChanges = [];
  for (let i = stopIndex; i < lowerPriorityTrain.mission_plan.length; i++) {
    const stop = lowerPriorityTrain.mission_plan[i];
    const originalArrival = stop.scheduled_arrival_time;
    const originalDeparture = stop.scheduled_departure_time;

    stop.scheduled_arrival_time = addMinutesToTime(originalArrival, delayAmount);
    stop.scheduled_departure_time = addMinutesToTime(originalDeparture, delayAmount);

    resolutionChanges.push({
      trainId: lowerPriorityTrain.train_no,
      stopIndex: i,
      originalArrival,
      originalDeparture,
      newArrival: stop.scheduled_arrival_time,
      newDeparture: stop.scheduled_departure_time,
      reason: `${type} resolution - delayed lower priority train`
    });
  }

  return resolutionChanges;
}

// Helper functions for rule-based conflict resolution

// Find overlapping segments between two routes
function findOverlappingSegments(route1, route2) {
  const segments1 = [];
  const segments2 = [];

  // Convert routes to segments
  for (let i = 0; i < route1.length - 1; i++) {
    segments1.push(`${route1[i]}-${route1[i + 1]}`);
  }
  for (let i = 0; i < route2.length - 1; i++) {
    segments2.push(`${route2[i]}-${route2[i + 1]}`);
  }

  // Find common segments
  const overlapping = segments1.filter(segment => segments2.includes(segment));
  return overlapping;
}

// Convert time string (HH:MM:SS) to minutes since midnight
function timeToMinutes(timeStr) {
  const [hours, minutes, seconds] = timeStr.split(':').map(Number);
  return hours * 60 + minutes + (seconds || 0) / 60;
}

// Add minutes to a time string and return new time string
function addMinutesToTime(timeStr, minutesToAdd) {
  const totalMinutes = timeToMinutes(timeStr) + minutesToAdd;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = Math.floor(totalMinutes % 60);
  const seconds = Math.floor((totalMinutes % 1) * 60);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}