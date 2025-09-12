"use client";
import React, { useState } from 'react';
import Link from 'next/link';


export default function ControlPanel({ config, state, trainTrails, setTrainTrails, isRunning, start, pause, restart, onDelayInjected }) {
  const [delayInput, setDelayInput] = useState({});
  const [injectingDelay, setInjectingDelay] = useState({});
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const [pendingTrain, setPendingTrain] = useState(null);
  const [pendingDelay, setPendingDelay] = useState(null);

  if (!config) return <div className="text-white p-4">Loading control panel...</div>;

  const trainList = config.train_roster || [];


  // Step 1: Preview delay changes
  const injectDelay = async (trainNo, delayMinutes) => {
    if (!delayMinutes || delayMinutes < 1) return;
    setInjectingDelay(prev => ({ ...prev, [trainNo]: true }));
    try {
      const response = await fetch('/api/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainId: trainNo,
          delayMinutes: parseInt(delayMinutes, 10),
          mode: 'preview'
        })
      });
      const result = await response.json();
      if (response.ok && result.success && result.changes) {
        setPendingSuggestion(result);
        setPendingTrain(trainNo);
        setPendingDelay(delayMinutes);
      } else {
        alert(result.message || 'Failed to preview delay changes');
      }
    } catch (error) {
      alert(`❌ Error previewing delay: ${error.message}`);
    } finally {
      setInjectingDelay(prev => ({ ...prev, [trainNo]: false }));
    }
  };

  // Step 2: Accept changes (commit)
  const acceptSuggestion = async () => {
    if (!pendingTrain || !pendingDelay) return;
    setInjectingDelay(prev => ({ ...prev, [pendingTrain]: true }));
    try {
      const response = await fetch('/api/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainId: pendingTrain,
          delayMinutes: parseInt(pendingDelay, 10),
          mode: 'commit'
        })
      });
      const result = await response.json();
      if (response.ok && result.success) {
        if (onDelayInjected && pendingSuggestion.changes) {
          onDelayInjected({
            timestamp: new Date().toISOString(),
            injectedTrain: pendingTrain,
            delayMinutes: pendingDelay,
            changes: pendingSuggestion.changes,
            conflictsDetected: pendingSuggestion.conflictsDetected || 0
          });
        }
        setPendingSuggestion(null);
        setPendingTrain(null);
        setPendingDelay(null);
        if (isRunning) start();
        alert(`✅ Delay of ${pendingDelay} minutes injected for ${pendingTrain}`);
      } else {
        alert(result.message || 'Failed to apply delay changes');
      }
    } catch (error) {
      alert(`❌ Error applying delay: ${error.message}`);
    } finally {
      setInjectingDelay(prev => ({ ...prev, [pendingTrain]: false }));
      setDelayInput(prev => ({ ...prev, [pendingTrain]: '' }));
    }
  };

  // Step 3: Reject changes (discard)
  const rejectSuggestion = () => {
    setPendingSuggestion(null);
    setPendingTrain(null);
    setPendingDelay(null);
  };

  return (
    <React.Fragment>
      {/* Suggestion Modal */}
      {pendingSuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Schedule Change Suggestion</h2>
            <div className="mb-4 text-gray-800">
              <p className="mb-2">Proposed changes for delay of <b>{pendingDelay} min</b> on train <b>{pendingTrain}</b>:</p>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-xs border">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="px-2 py-1">Train</th>
                      <th className="px-2 py-1">Stop #</th>
                      <th className="px-2 py-1">Original Arrival</th>
                      <th className="px-2 py-1">New Arrival</th>
                      <th className="px-2 py-1">Original Departure</th>
                      <th className="px-2 py-1">New Departure</th>
                      <th className="px-2 py-1">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingSuggestion.changes.map((change, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="px-2 py-1 font-semibold">{change.trainId}</td>
                        <td className="px-2 py-1">{change.stopIndex + 1}</td>
                        <td className="px-2 py-1 line-through text-red-500">{change.originalArrival}</td>
                        <td className="px-2 py-1 text-green-700 font-bold">{change.newArrival}</td>
                        <td className="px-2 py-1 line-through text-red-500">{change.originalDeparture}</td>
                        <td className="px-2 py-1 text-green-700 font-bold">{change.newDeparture}</td>
                        <td className="px-2 py-1 text-blue-600">{change.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-4">
              <button onClick={rejectSuggestion} className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold">Reject</button>
              <button onClick={acceptSuggestion} className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white font-semibold">Accept & Apply</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-900/80 backdrop-blur-sm p-4 rounded-lg w-full h-full flex flex-col shadow-2xl">
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
        <h2 className="text-xl font-bold text-white">Controls</h2>
        <div className="text-lg font-mono text-yellow-400">{state?.simulationTime || '00:00:00'}</div>
      </div>
      <div className="flex gap-2 mb-4">
        {isRunning ? (
          <button className="flex-1 px-3 py-2 rounded bg-yellow-500 text-white hover:bg-yellow-600 transition-colors" onClick={pause}>Pause</button>
        ) : (
          <button className="flex-1 px-3 py-2 rounded bg-green-500 text-white hover:bg-green-600 transition-colors" onClick={start}>Play</button>
        )}
        <button className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors" onClick={restart}>Reset</button>
      </div>
      <div className="space-y-4 overflow-y-auto flex-1 pr-2">
        {trainList.map(trainConfig => {
          const liveTrain = state?.trains?.find(t => t.train_no === trainConfig.train_no);
          const train = liveTrain || trainConfig; // Fallback to config
          const status = liveTrain?.status || 'NOT_STARTED';
          const color = liveTrain?.color || trainConfig.color || '#ffffff';

          return (
            <div key={train.train_no} className="bg-gray-800/90 rounded-lg p-3 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white">{train.name} ({train.train_no})</span>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  status === 'AT_PLATFORM' ? 'bg-green-600' : 
                  status === 'IN_TRANSIT' ? 'bg-purple-600' :
                  'bg-gray-500'
                } text-white`}>{status}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-sm text-gray-300">Priority: {train.priority || 'N/A'}</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={delayInput[train.train_no] || ''}
                  onChange={e => setDelayInput({ ...delayInput, [train.train_no]: e.target.value })}
                  placeholder="Delay (min)"
                  className="w-20 px-2 py-1 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  className={`ml-2 px-3 py-1 rounded transition-colors ${
                    injectingDelay[train.train_no]
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                  onClick={() => {
                    const mins = parseInt(delayInput[train.train_no], 10);
                    if (mins && mins > 0) {
                      injectDelay(train.train_no, mins);
                    }
                  }}
                  disabled={injectingDelay[train.train_no]}
                >
                  {injectingDelay[train.train_no] ? 'Injecting...' : 'Inject Delay'}
                </button>
              </div>
              {liveTrain?.delay_timer > 0 && (
                <div className="text-xs text-yellow-400 bg-yellow-900 px-2 py-1 rounded text-center">
                  Active Delay: {Math.ceil(liveTrain.delay_timer / 60)} minutes remaining
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <button
                  className="w-6 h-6 rounded-full border-2"
                  style={{ background: trainTrails[train.train_no] ? color : '#444', borderColor: color, transition: 'background 0.2s' }}
                  onClick={() => setTrainTrails(trails => ({ ...trails, [train.train_no]: !trails[train.train_no] }))}
                  title={trainTrails[train.train_no] ? 'Hide path' : 'Show path'}
                />
                <span className="text-xs text-gray-300">Show path</span>
              </div>
            </div>
          );
        })}
        </div>
        <Link href="/dashboard" className="text-center bg-indigo-600 text-white mt-4 px-4 py-2 rounded-lg shadow hover:bg-indigo-700 font-semibold transition-colors">
            Back to Dashboard
        </Link>
      </div>
    </React.Fragment>
  );
}
