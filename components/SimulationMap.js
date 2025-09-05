"use client";
import React from 'react';

function getNodePosition(node, gridWidth, gridHeight) {
  const x = node.position?.x ?? Math.floor(Math.random() * gridWidth);
  const y = node.position?.y ?? Math.floor(Math.random() * gridHeight);
  return { left: x, top: y };
}

function getEdgeStyle(start, end) {
  const dx = end.left - start.left;
  const dy = end.top - start.top;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return {
    position: 'absolute',
    left: start.left,
    top: start.top,
    width: length,
    height: 4,
    background: 'linear-gradient(to right, #444, #888)',
    transform: `rotate(${angle}deg)`,
    transformOrigin: '0 0',
    zIndex: 1,
  };
}

function getTrainPosition(train, nodes, edges) {
  const edge = edges.find(e => e.id === train.current_edge_id);
  if (!edge) return { left: 0, top: 0 };
  const startNode = nodes.find(n => n.id === edge.start_node_id);
  const endNode = nodes.find(n => n.id === edge.end_node_id);
  if (!startNode || !endNode) return { left: 0, top: 0 };
  const start = getNodePosition(startNode, 2400, 1000);
  const end = getNodePosition(endNode, 2400, 1000);
  const left = start.left + (end.left - start.left) * train.progress_on_edge;
  const top = start.top + (end.top - start.top) * train.progress_on_edge;
  return { left, top };
}

export default function SimulationMap({ config, state, showTrails }) {
  if (!config || !state) return <div className="text-white">Loading map...</div>;
  const { nodes, edges, section_details } = config;
  const gridWidth = section_details?.grid_dimensions?.width || 2400;
  const gridHeight = section_details?.grid_dimensions?.height || 1000;

  // Group platform nodes by station_id
  const platformNodesByStation = {};
  nodes.forEach(node => {
    if (node.type === 'STATION_PLATFORM' && node.station_id) {
      if (!platformNodesByStation[node.station_id]) platformNodesByStation[node.station_id] = [];
      platformNodesByStation[node.station_id].push(node);
    }
  });

  // Render rectangles for each station
  const stationRects = Object.entries(platformNodesByStation).map(([stationId, platformNodes]) => {
    if (platformNodes.length === 0) return null;
    // Get bounding box
    const xs = platformNodes.map(n => n.position?.x ?? 0);
    const ys = platformNodes.map(n => n.position?.y ?? 0);
    const minX = Math.min(...xs) - 20;
    const maxX = Math.max(...xs) + 20;
    const minY = Math.min(...ys) - 20;
    const maxY = Math.max(...ys) + 20;
    const stationName = platformNodes[0].station_name || stationId;
    return (
      <div
        key={`station-rect-${stationId}`}
        className="absolute border-4 border-blue-300 bg-blue-200 bg-opacity-10 rounded-xl"
        style={{ left: minX, top: minY, width: maxX - minX, height: maxY - minY, zIndex: 1 }}
      >
        <div className="absolute left-2 top-2 text-blue-700 text-xs font-bold bg-white bg-opacity-80 rounded px-2 py-1 shadow">{stationName}</div>
      </div>
    );
  });

  // Grid lines config
  const gridSpacing = 50;
  const gridLines = [];
  for (let x = 0; x <= gridWidth; x += gridSpacing) {
    gridLines.push(
      <div
        key={`vgrid-${x}`}
        style={{
          position: 'absolute',
          left: x,
          top: 0,
          width: 1,
          height: gridHeight,
          background: 'rgba(200,200,200,0.15)',
          zIndex: 0,
        }}
      />
    );
  }
  for (let y = 0; y <= gridHeight; y += gridSpacing) {
    gridLines.push(
      <div
        key={`hgrid-${y}`}
        style={{
          position: 'absolute',
          left: 0,
          top: y,
          width: gridWidth,
          height: 1,
          background: 'rgba(200,200,200,0.15)',
          zIndex: 0,
        }}
      />
    );
  }

  // Green dots at grid intersections
  const gridDots = [];
  for (let x = 0; x <= gridWidth; x += gridSpacing) {
    for (let y = 0; y <= gridHeight; y += gridSpacing) {
      gridDots.push(
        <div
          key={`dot-${x}-${y}`}
          className="absolute w-2 h-2 rounded-full bg-green-400 opacity-80"
          style={{ left: x - 1, top: y - 1, zIndex: 1 }}
          title={`(${x}, ${y})`}
        />
      );
    }
  }

  return (
    <div className="relative bg-gray-800 w-full h-[1000px] rounded-lg" style={{ width: gridWidth, height: gridHeight, overflow: 'hidden' }}>
      {/* Grid background */}
      {gridLines}
      {gridDots}
      {/* Station rectangles */}
      {stationRects}
      {/* Edges */}
      {edges.map(edge => {
        const startNode = nodes.find(n => n.id === edge.start_node_id);
        const endNode = nodes.find(n => n.id === edge.end_node_id);
        if (!startNode || !endNode) return null;
        const start = getNodePosition(startNode, gridWidth, gridHeight);
        const end = getNodePosition(endNode, gridWidth, gridHeight);
        return (
          <div key={edge.id} style={getEdgeStyle(start, end)} />
        );
      })}
      {/* Nodes */}
      {nodes.map(node => {
        const pos = getNodePosition(node, gridWidth, gridHeight);
        let bg = 'bg-blue-500';
        if (node.type === 'STATION_GATEWAY') bg = 'bg-yellow-500';
        if (node.type === 'STATION_PLATFORM') bg = 'bg-green-500';
        if (node.type === 'JUNCTION') bg = 'bg-red-500';
        // Center the dot by offsetting by half its width/height (w-6 h-6 => 24px)
        return (
          <div
            key={node.id}
            className={`absolute rounded-full ${bg} w-6 h-6 border-2 border-white flex items-center justify-center text-xs text-white group`}
            style={{ left: pos.left - 12, top: pos.top - 12, zIndex: 2 }}
          >
            {typeof node.id === 'string' ? node.id.split('_').pop() : ''}
            <div
              className="absolute left-8 top-1 bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200"
              style={{ minWidth: 120, zIndex: 10 }}
            >
              <div><b>ID:</b> {node.id}</div>
              {node.name && <div><b>Name:</b> {node.name}</div>}
              {node.station && <div><b>Station:</b> {node.station}</div>}
              {node.position && <div><b>Pos:</b> ({node.position.x}, {node.position.y})</div>}
              {node.type && <div><b>Type:</b> {node.type}</div>}
            </div>
          </div>
        );
      })}
      {/* Trains */}
      {state.trains.map(train => {
        const pos = getTrainPosition(train, nodes, edges);
        // Render train as a colored triangle arrow
        return (
          <div
            key={train.train_no}
            className="absolute"
            style={{ left: pos.left, top: pos.top, zIndex: 3 }}
            title={train.name}
          >
            <svg width="18" height="18" style={{ display: 'block' }}>
              <polygon points="0,18 9,0 18,18" fill={train.color} stroke="white" strokeWidth="2" />
            </svg>
          </div>
        );
      })}
      {/* Dotted train trails (side of track) */}
      {showTrails && state.trains.map(train => {
        // Draw dotted trail for each train's route
        const route = train.route_path;
        if (!route || route.length < 2) return null;
        const trailSegments = [];
        for (let i = 1; i < route.length; i++) {
          const fromNode = nodes.find(n => n.id === route[i - 1]);
          const toNode = nodes.find(n => n.id === route[i]);
          if (!fromNode || !toNode) continue;
          const from = getNodePosition(fromNode, gridWidth, gridHeight);
          const to = getNodePosition(toNode, gridWidth, gridHeight);
          trailSegments.push(
            <svg key={`trail-${train.train_no}-${i}`} style={{ position: 'absolute', left: Math.min(from.left, to.left), top: Math.min(from.top, to.top), pointerEvents: 'none', zIndex: 2 }} width={Math.abs(to.left - from.left) || 1} height={Math.abs(to.top - from.top) || 1}>
              <line
                x1={from.left < to.left ? 0 : Math.abs(from.left - to.left)}
                y1={from.top < to.top ? 0 : Math.abs(from.top - to.top)}
                x2={to.left < from.left ? 0 : Math.abs(to.left - from.left)}
                y2={to.top < from.top ? 0 : Math.abs(to.top - from.top)}
                stroke={train.color}
                strokeDasharray="4,4"
                strokeWidth="3"
                opacity="0.7"
              />
            </svg>
          );
        }
        return trailSegments;
      })}
    </div>
  );
}
