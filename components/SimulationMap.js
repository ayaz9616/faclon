"use client";
import React, { useRef, useEffect, useState } from 'react';
import Image from 'next/image';

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
  // Always show at node if at node, or if progress_on_edge is 0 or 1, or if current_edge_id is null
  if (
    train.current_node_id &&
    (
      train.status === 'AT_PLATFORM' ||
      train.status === 'HALTED' ||
      !train.current_edge_id ||
      train.progress_on_edge <= 0.0001 ||
      train.progress_on_edge >= 0.9999
    )
  ) {
    const node = nodes.find(n => n.id === train.current_node_id);
    if (node) {
      return getNodePosition(node, 2400, 1000);
    }
  }

  // If the train is in transit, draw it along the edge.
  const edge = edges.find(e => e.id === train.current_edge_id);
  if (!edge) {
    // Fallback: show at node if possible
    if (train.current_node_id) {
      const node = nodes.find(n => n.id === train.current_node_id);
      if (node) return getNodePosition(node, 2400, 1000);
    }
    return { left: -100, top: -100 };
  }
  const startNode = nodes.find(n => n.id === edge.start_node_id);
  const endNode = nodes.find(n => n.id === edge.end_node_id);
  if (!startNode || !endNode) return { left: 0, top: 0 };
  const start = getNodePosition(startNode, 2400, 1000);
  const end = getNodePosition(endNode, 2400, 1000);
  const left = start.left + (end.left - start.left) * train.progress_on_edge;
  const top = start.top + (end.top - start.top) * train.progress_on_edge;
  return { left, top };
}



export default function SimulationMap({ config, state, trainTrails, className = "" }) {
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  // --- Smooth interpolation state ---
  const [interpTrains, setInterpTrains] = useState(state?.trains || []);
  const lastStateRef = useRef({ trains: state?.trains || [], time: Date.now() });
  const nextStateRef = useRef({ trains: state?.trains || [], time: Date.now() });
  const animFrameRef = useRef();

  // --- Pan/zoom state ---
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef();
  const lastTouchDist = useRef(null);

  // Listen for fullscreen change to sync state (must be before any early return)
  useEffect(() => {
    function onFsChange() {
      const fsElem = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
      setIsFullscreen(!!fsElem);
    }
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('mozfullscreenchange', onFsChange);
    document.addEventListener('MSFullscreenChange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('mozfullscreenchange', onFsChange);
      document.removeEventListener('MSFullscreenChange', onFsChange);
    };
  }, []);

  // Manual event listener for wheel to prevent passive listener issue
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      e.preventDefault();
      setZoom(prevZoom => {
        let newZoom = prevZoom - e.deltaY * 0.001;
        return Math.max(0.2, Math.min(3, newZoom));
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []); // Empty dependency array means this runs once on mount

  // Interpolation effect
  useEffect(() => {
    if (!state?.trains) return;
    const now = Date.now();
    lastStateRef.current = { trains: interpTrains, time: now };
    nextStateRef.current = { trains: state.trains, time: now };
    // Match backend tick interval for smoothness (default 1000ms)
    const duration = 1000;
    let running = true;
    function animate() {
      if (!running) return;
      const t0 = lastStateRef.current.time;
      const t1 = nextStateRef.current.time + duration;
      const t = Date.now();
      const frac = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
      const trains = state.trains.map((train, i) => {
        const prev = (lastStateRef.current.trains && lastStateRef.current.trains[i]) || train;
        if (train.status === 'HALTED') {
          return { ...train, progress_on_edge: train.progress_on_edge };
        }
        // If train changed edge, snap to new edge
        if (prev.current_edge_id !== train.current_edge_id) {
          return { ...train };
        }
        const interpProgress = prev.progress_on_edge + (train.progress_on_edge - prev.progress_on_edge) * frac;
        return { ...train, progress_on_edge: interpProgress };
      });
      setInterpTrains(trains);
      if (frac < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    }
    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
    // eslint-disable-next-line
  }, [state?.trains]);

  // Mouse/touch pan/zoom handlers
  function handleMouseDown(e) {
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  }
  function handleMouseMove(e) {
    if (!isPanning) return;
    setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }
  function handleMouseUp() {
    setIsPanning(false);
  }
  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist.current = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1) {
      setIsPanning(true);
      setPanStart({ x: e.touches[0].clientX - panOffset.x, y: e.touches[0].clientY - panOffset.y });
    }
  }
  function handleTouchMove(e) {
    if (e.touches.length === 2 && lastTouchDist.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let newZoom = zoom * (dist / lastTouchDist.current);
      newZoom = Math.max(0.2, Math.min(3, newZoom));
      setZoom(newZoom);
      lastTouchDist.current = dist;
    } else if (e.touches.length === 1 && isPanning) {
      setPanOffset({ x: e.touches[0].clientX - panStart.x, y: e.touches[0].clientY - panStart.y });
    }
  }
  function handleTouchEnd(e) {
    if (e.touches.length < 2) {
      lastTouchDist.current = null;
    }
    if (e.touches.length === 0) {
      setIsPanning(false);
    }
  }

  // Fullscreen handlers
  function handleFullscreenToggle() {
    setIsFullscreen(f => !f);
    setTimeout(() => {
      if (!containerRef.current) return;
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) containerRef.current.requestFullscreen();
        else if (containerRef.current.webkitRequestFullscreen) containerRef.current.webkitRequestFullscreen();
        else if (containerRef.current.mozRequestFullScreen) containerRef.current.mozRequestFullScreen();
        else if (containerRef.current.msRequestFullscreen) containerRef.current.msRequestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
      }
    }, 10);
  }

  // Make grid much larger
  const gridWidth = 6000;
  const gridHeight = 4000;

  // Early return for loading state (after hooks)
  if (!config || !state) return <div className="w-full h-full bg-gray-800 flex items-center justify-center text-white">Loading Map...</div>;
  const { nodes, edges } = config;
  // (Removed old gridWidth/gridHeight, using large scrollable grid)

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
    const minX = Math.min(...xs) - 50;
    const maxX = Math.max(...xs) + 50;
    const minY = Math.min(...ys) - 100;
    const maxY = Math.max(...ys) + 50;
    const stationName = platformNodes[0].station_name || stationId;
    return (
      <div key={`station-rect-outer-${stationId}`}>
        <div
          className="absolute border-4 border-blue-300 bg-blue-200 bg-opacity-10 rounded-xl"
          style={{ left: minX, top: minY, width: maxX - minX, height: maxY - minY, zIndex: 1 }}
        >
          <div className="absolute left-2 top-2 text-blue-700 text-xs font-bold bg-white bg-opacity-80 rounded px-2 py-1 shadow">{stationName}</div>
        </div>
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
  // Center green dots exactly at grid intersections
  for (let x = 0; x <= gridWidth; x += gridSpacing) {
    for (let y = 0; y <= gridHeight; y += gridSpacing) {
      gridDots.push(
        <div
          key={`dot-${x}-${y}`}
          className="absolute w-1 h-1 rounded-full bg-green-400 opacity-80"
          style={{ left: x - 0.5, top: y - 0.5, zIndex: 1 }} // w-1 h-1 => 2px, offset by 0.5px to center
          title={`(${x}, ${y})`}
        />
      );
    }
  }


  return (
    <div
      ref={containerRef}
  className={`relative bg-gray-800 ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'w-full h-[800px] rounded-lg'} overflow-hidden cursor-grab select-none hide-scrollbar ${className}`}
      style={isFullscreen ? { width: '100vw', height: '100vh', position: 'fixed', left: 0, top: 0 } : { width: '100%', height: '800px', position: 'relative' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
    >
      {/* Fullscreen Toggle Button */}
      <button
        onClick={handleFullscreenToggle}
        style={{ position: 'absolute', right: 16, top: 16, zIndex: 100, background: '#222', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 700, boxShadow: '0 2px 8px #0004', cursor: 'pointer', opacity: 0.85 }}
      >
        {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
      </button>
      <div
        style={{
          width: gridWidth,
          height: gridHeight,
          position: 'absolute',
          left: panOffset.x,
          top: panOffset.y,
          transform: `scale(${zoom})`,
          transformOrigin: '0 0',
          transition: isPanning ? 'none' : 'box-shadow 0.2s',
          boxShadow: isPanning ? '0 0 0 4px #0f0 inset' : undefined,
          cursor: isPanning ? 'grabbing' : 'grab',
        }}
      >
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
          // Calculate perpendicular offset for rails
          const dx = end.left - start.left;
          const dy = end.top - start.top;
          const length = Math.sqrt(dx * dx + dy * dy);
          const normX = dx / length;
          const normY = dy / length;
          // Perpendicular vector (normalized)
          const perpX = -normY;
          const perpY = normX;
          const railOffset = 12; // px, half the distance between rails (increased for wider gap)
          // Rail 1
          const s1 = { x: start.left + perpX * railOffset, y: start.top + perpY * railOffset };
          const e1 = { x: end.left + perpX * railOffset, y: end.top + perpY * railOffset };
          // Rail 2
          const s2 = { x: start.left - perpX * railOffset, y: start.top - perpY * railOffset };
          const e2 = { x: end.left - perpX * railOffset, y: end.top - perpY * railOffset };
          // SVG bounding box
          const minX = Math.min(s1.x, e1.x, s2.x, e2.x);
          const minY = Math.min(s1.y, e1.y, s2.y, e2.y);
          const maxX = Math.max(s1.x, e1.x, s2.x, e2.x);
          const maxY = Math.max(s1.y, e1.y, s2.y, e2.y);
          const width = maxX - minX || 1;
          const height = maxY - minY || 1;
          // Offset all points to SVG local coordinates
          const toLocal = (pt) => ({ x: pt.x - minX, y: pt.y - minY });
          const ls1 = toLocal(s1), le1 = toLocal(e1), ls2 = toLocal(s2), le2 = toLocal(e2);
          return (
            <svg
              key={edge.id}
              style={{ position: 'absolute', left: minX, top: minY, pointerEvents: 'none', zIndex: 1 }}
              width={width}
              height={height}
            >
              <line x1={ls1.x} y1={ls1.y} x2={le1.x} y2={le1.y} stroke="#444" strokeWidth="4" />
              <line x1={ls2.x} y1={ls2.y} x2={le2.x} y2={le2.y} stroke="#444" strokeWidth="4" />
              {/* Optionally, add sleepers (ties) */}
              {(() => {
                const sleeperCount = Math.floor(length / 18);
                const sleepers = [];
                for (let i = 1; i < sleeperCount; i++) {
                  const t = i / sleeperCount;
                  // Center point
                  const cx = start.left + dx * t;
                  const cy = start.top + dy * t;
                  // Sleeper endpoints (across rails)
                  const sx = cx + perpX * (railOffset + 4);
                  const sy = cy + perpY * (railOffset + 4);
                  const ex = cx - perpX * (railOffset + 4);
                  const ey = cy - perpY * (railOffset + 4);
                  const sl = toLocal({ x: sx, y: sy });
                  const el = toLocal({ x: ex, y: ey });
                  sleepers.push(
                    <line
                      key={`sleeper-${i}`}
                      x1={sl.x}
                      y1={sl.y}
                      x2={el.x}
                      y2={el.y}
                      stroke="#bba"
                      strokeWidth="3"
                      opacity="0.7"
                    />
                  );
                }
                return sleepers;
              })()}
            </svg>
          );
        })}
        {/* Nodes */}
        {nodes.map(node => {
          const pos = getNodePosition(node, gridWidth, gridHeight);
          let bg = 'bg-blue-500';
          let opacity = 1;
          if (node.type === 'STATION_GATEWAY') { bg = 'bg-yellow-500'; opacity = 0.3; }
          if (node.type === 'STATION_PLATFORM') { bg = 'bg-green-500'; opacity = 1; }
          if (node.type === 'JUNCTION') { bg = 'bg-red-500'; opacity = 0.3; }
          if (node.type !== 'STATION_PLATFORM') opacity = 0.3;
          return (
            <div
              key={node.id}
              className={`absolute rounded-full ${bg} w-6 h-6 border-2 border-white flex items-center justify-center text-xs text-white group`}
              style={{ left: pos.left - 12, top: pos.top - 12, zIndex: 2, opacity }}
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
        {interpTrains.map(train => {
          const pos = getTrainPosition(train, nodes, edges);
          return (
            <div
              key={train.train_no}
              className="absolute"
              style={{ left: pos.left - 40, top: pos.top - 40, zIndex: 3 }}
              title={train.name}
            >
              <Image src="https://media.tenor.com/V6HYr1pd1VkAAAAi/train.gif" alt="train" width={80} height={80} style={{ height: 'auto' }}/>
            </div>
          );
        })}
        {/* Train Trails */}
        {state?.trains?.map(train => {
          if (!trainTrails?.[train.train_no]) return null;

          // Get the full train configuration, including the route_path
          const trainConfig = config.train_roster.find(t => t.train_no === train.train_no);
          if (!trainConfig || !trainConfig.route_path) return null;

          const trailSegments = [];
          for (let i = 0; i < trainConfig.route_path.length - 1; i++) {
            const startNodeId = trainConfig.route_path[i];
            const endNodeId = trainConfig.route_path[i + 1];
            
            const edge = edges.find(e => 
              (e.start_node_id === startNodeId && e.end_node_id === endNodeId) ||
              (e.start_node_id === endNodeId && e.end_node_id === startNodeId)
            );

            if (edge) {
              const startNode = nodes.find(n => n.id === startNodeId);
              const endNode = nodes.find(n => n.id === endNodeId);

              if (startNode && endNode) {
                const start = getNodePosition(startNode, gridWidth, gridHeight);
                const end = getNodePosition(endNode, gridWidth, gridHeight);
                
                const minX = Math.min(start.left, end.left);
                const minY = Math.min(start.top, end.top);
                const width = Math.abs(start.left - end.left) || 2;
                const height = Math.abs(start.top - end.top) || 2;

                trailSegments.push(
                  <svg
                    key={`trail-${train.train_no}-${edge.id}`}
                    style={{
                      position: 'absolute',
                      left: minX,
                      top: minY,
                      width: width,
                      height: height,
                      pointerEvents: 'none',
                      zIndex: 1,
                      filter: `drop-shadow(0 0 10px ${train.color})`,
                    }}
                  >
                    <line
                      x1={start.left - minX}
                      y1={start.top - minY}
                      x2={end.left - minX}
                      y2={end.top - minY}
                      stroke={train.color}
                      strokeWidth="4"
                      opacity="1"
                    />
                  </svg>
                );
              }
            }
          }
          // Add a key to the fragment returned for each train
          return (
            <React.Fragment key={train.train_no}>
              {trailSegments}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
