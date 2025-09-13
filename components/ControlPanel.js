
"use client";
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';



export default function ControlPanel({ config, state, trainTrails, setTrainTrails, isRunning, start, pause, restart, onDelayInjected }) {
  const [delayInput, setDelayInput] = useState({});
  const [injectingDelay, setInjectingDelay] = useState({});
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const [pendingTrain, setPendingTrain] = useState(null);
  const [pendingDelay, setPendingDelay] = useState(null);

  // --- NEW HOOKS AND HELPERS FOR SCHEDULE EDITING ---
  const nodeMap = React.useMemo(() => {
    if (!config?.nodes) return {};
    const map = {};
    for (const node of config.nodes) map[node.id] = node;
    return map;
  }, [config]);

  const [editingSchedule, setEditingSchedule] = useState(false);
  const [editedSchedule, setEditedSchedule] = useState([]);

  React.useEffect(() => {
    if (pendingSuggestion && editingSchedule && pendingSuggestion.changes) {
      setEditedSchedule(pendingSuggestion.changes.map(change => ({ ...change })));
    }
  }, [pendingSuggestion, editingSchedule]);

  function getPlatformsForStation(station_id) {
    return Object.values(nodeMap).filter(n => n.type === 'STATION_PLATFORM' && n.station_id === station_id);
  }

  function saveEditedSchedule() {
    if (pendingSuggestion) {
      pendingSuggestion.changes = editedSchedule;
      setEditingSchedule(false);
    }
  }

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
      {/* Suggestion Modal rendered in portal for true screen centering */}
      {pendingSuggestion && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-900 via-green-900 to-blue-800 bg-opacity-90 transition-opacity p-8 sm:p-12 md:p-20">
          <div
            className="relative rounded-3xl shadow-2xl p-10 md:p-16 max-w-5xl w-full border-4 border-green-400 animate-fade-in flex flex-col"
            style={{ background: 'linear-gradient(135deg, #e0f7fa 0%, #b2f7ef 100%)', minHeight: '60vh', minWidth: '60vw', maxHeight: '90vh', overflowY: 'auto' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <button
              onClick={rejectSuggestion}
              className="absolute top-5 right-6 text-green-500 hover:text-blue-700 text-3xl font-bold focus:outline-none"
              aria-label="Close modal"
            >
              &times;
            </button>
            <h2 id="modal-title" className="text-3xl font-extrabold mb-6 text-blue-800 drop-shadow">Schedule Change Suggestion</h2>
            <div className="mb-6 text-green-900">
              <p className="mb-4 text-lg font-semibold text-blue-900">Proposed changes for delay of <b className='text-green-700'>{pendingDelay} min</b> on train <b className='text-blue-700'>{pendingTrain}</b>:</p>
              <div className="mb-4 flex justify-end">
                {!editingSchedule && (
                  <button onClick={() => setEditingSchedule(true)} className="px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white font-semibold">Edit Schedule</button>
                )}
              </div>
              <div className="overflow-x-auto max-h-96 rounded border-2 border-blue-300 bg-white/80 p-2">
                <table className="w-full text-sm border">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-200 via-green-200 to-blue-100">
                      <th className="px-3 py-2 text-blue-900 font-bold">Train No</th>
                      <th className="px-3 py-2 text-blue-900 font-bold">Node</th>
                      <th className="px-3 py-2 text-green-900 font-bold">Type</th>
                      <th className="px-3 py-2 text-blue-700 font-bold">Original Arrival</th>
                      <th className="px-3 py-2 text-green-700 font-bold">New Arrival</th>
                      <th className="px-3 py-2 text-blue-700 font-bold">Original Departure</th>
                      <th className="px-3 py-2 text-green-700 font-bold">New Departure</th>
                      <th className="px-3 py-2 text-cyan-800 font-bold">Reason</th>
                      {editingSchedule && <th className="px-3 py-2 text-cyan-800 font-bold">Edit</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(editingSchedule ? editedSchedule : pendingSuggestion.changes).map((change, idx) => {
                      // Always use change.nodeId for lookup
                      const nodeId = change.nodeId || change.trainId || change.stopId;
                      const node = nodeMap[nodeId] || {};
                      const isPlatform = node.type === 'STATION_PLATFORM';
                      const isTurn = node.type === 'TRACK_TURN';
                      // Try to get train number for this row
                      let trainNo = change.trainNo || change.train_no || change.trainId || pendingTrain || '';
                      return (
                        <tr key={idx} className="border-b">
                          <td className="px-3 py-2 font-mono text-blue-900 font-bold">{trainNo}</td>
                          <td className="px-3 py-2 font-semibold text-blue-900">{node.name || ''}</td>
                          <td className="px-3 py-2 text-green-900">{node.type || ''}</td>
                          <td className="px-3 py-2 line-through text-red-500">{change.originalArrival}</td>
                          <td className="px-3 py-2 text-green-700 font-bold">
                            {editingSchedule && (isTurn || node.type === 'TRACK' || node.type === 'TRACK_TURN') ? (
                              <input
                                type="time"
                                value={change.newArrival?.slice(0,5) || ''}
                                onChange={e => {
                                  const val = e.target.value + ':00';
                                  setEditedSchedule(sch => sch.map((c, i) => i === idx ? { ...c, newArrival: val } : c));
                                }}
                                className="px-2 py-1 rounded border border-blue-300 bg-white text-blue-900 w-24"
                              />
                            ) : change.newArrival}
                          </td>
                          <td className="px-3 py-2 line-through text-red-500">{change.originalDeparture}</td>
                          <td className="px-3 py-2 text-green-700 font-bold">
                            {editingSchedule && (isTurn || node.type === 'TRACK' || node.type === 'TRACK_TURN') ? (
                              <input
                                type="time"
                                value={change.newDeparture?.slice(0,5) || ''}
                                onChange={e => {
                                  const val = e.target.value + ':00';
                                  setEditedSchedule(sch => sch.map((c, i) => i === idx ? { ...c, newDeparture: val } : c));
                                }}
                                className="px-2 py-1 rounded border border-green-300 bg-white text-green-900 w-24"
                              />
                            ) : change.newDeparture}
                          </td>
                          <td className="px-3 py-2 text-cyan-800">{change.reason}</td>
                          {editingSchedule && isPlatform && (
                            <td className="px-3 py-2">
                              <select
                                value={change.nodeId}
                                onChange={e => {
                                  setEditedSchedule(sch => sch.map((c, i) => i === idx ? { ...c, nodeId: e.target.value } : c));
                                }}
                                className="px-2 py-1 rounded border border-blue-400 bg-white text-blue-900"
                              >
                                {getPlatformsForStation(node.station_id).map(pf => (
                                  <option key={pf.id} value={pf.id}>{pf.name}</option>
                                ))}
                              </select>
                            </td>
                          )}
                          {editingSchedule && !isPlatform && <td className="px-3 py-2"></td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {editingSchedule && (
                <div className="flex justify-end gap-4 mt-4">
                  <button onClick={() => setEditingSchedule(false)} className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold">Cancel</button>
                  <button onClick={saveEditedSchedule} className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white font-semibold">Save Changes</button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-6 mt-6">
              <button onClick={rejectSuggestion} className="px-6 py-3 rounded-lg bg-gradient-to-r from-green-300 to-blue-300 hover:from-green-400 hover:to-blue-400 text-blue-900 font-bold shadow text-lg border-2 border-green-400">Reject</button>
              <button onClick={acceptSuggestion} className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white font-bold shadow text-lg border-2 border-blue-400">Accept & Apply</button>
            </div>
          </div>
        </div>,
        window.document.body
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
        
      </div>
    </React.Fragment>
  );
}
