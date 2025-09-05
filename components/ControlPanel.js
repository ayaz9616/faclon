"use client";
import React, { useState } from 'react';

export default function ControlPanel({ state, onInjectDisruption }) {
  const [delayInput, setDelayInput] = useState({});
  const [restarting, setRestarting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showTrails, setShowTrails] = useState(true);
  if (!state) return <div className="text-white">Loading control panel...</div>;

  async function handleRestart() {
    setRestarting(true);
    await fetch('/api/restart', { method: 'POST' });
    setRestarting(false);
    window.location.reload();
  }

  async function handlePausePlay() {
    await fetch('/api/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused: !paused })
    });
    setPaused(p => !p);
  }

  return (
    <div className="bg-gray-900 p-4 rounded-lg w-full max-w-md">
      <div className="flex justify-between items-center mb-4">
        <div className="text-lg font-bold text-white">Simulation Time: <span className="text-yellow-400">{state.simulation_time}</span></div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={handleRestart}
            disabled={restarting}
          >{restarting ? 'Resetting...' : 'Reset'}</button>
          <button
            className={`px-3 py-1 rounded ${paused ? 'bg-green-600' : 'bg-yellow-500'} text-white hover:bg-opacity-80`}
            onClick={handlePausePlay}
          >{paused ? 'Play' : 'Pause'}</button>
        </div>
      </div>
      <div className="mb-4">
        <label className="flex items-center gap-2 text-white">
          <input type="checkbox" checked={showTrails} onChange={e => setShowTrails(e.target.checked)} />
          Show train path trails
        </label>
      </div>
      <div className="space-y-4">
        {state.trains.map(train => (
          <div key={train.train_no} className="bg-gray-800 rounded-lg p-3 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-white">{train.name}</span>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${train.status === 'WAITING_FOR_PATH' ? 'bg-yellow-400 text-black' : 'bg-green-600 text-white'}`}>{train.status}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-300">Priority: {train.priority}</span>
              <input
                type="number"
                min={1}
                max={60}
                value={delayInput[train.train_no] || ''}
                onChange={e => setDelayInput({ ...delayInput, [train.train_no]: e.target.value })}
                placeholder="Delay (min)"
                className="w-20 px-2 py-1 rounded bg-gray-700 text-white border border-gray-600"
              />
              <button
                className="ml-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                onClick={() => {
                  const mins = parseInt(delayInput[train.train_no], 10) || 1;
                  onInjectDisruption(train.train_no, mins);
                  setDelayInput({ ...delayInput, [train.train_no]: '' });
                }}
              >Inject Delay</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
