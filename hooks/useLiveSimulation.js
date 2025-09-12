import { useState, useEffect, useCallback } from 'react';

const POLLING_INTERVAL = 1000; // ms

export default function useLiveSimulation(initialState) {
  const [simulationState, setSimulationState] = useState(initialState);
  const [isRunning, setIsRunning] = useState(false); // Start in a paused state
  const [error, setError] = useState(null);

  // Fetch the latest state from the server
  const poll = useCallback(async () => {
    try {
      const response = await fetch('/api/simulation');
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);
      const newState = await response.json();
      setSimulationState(newState);
      // Sync running state with server's state (if available, otherwise assume it's running if we are polling)
      if (typeof newState.isPaused !== 'undefined') {
        setIsRunning(!newState.isPaused);
      }

    } catch (err) {
      console.error("Polling error:", err);
      setError(err.message);
      setIsRunning(false); // Stop polling on error
    }
  }, []);

  // Effect for polling
  useEffect(() => {
    if (isRunning) {
      const timer = setInterval(poll, POLLING_INTERVAL);
      return () => clearInterval(timer);
    }
  }, [isRunning, poll]);

  // Control functions
  const sendControlAction = useCallback(async (action) => {
    try {
      const response = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error(`Action ${action} failed`);
      const newState = await response.json();
      setSimulationState(newState);
      // Update running state immediately based on action
      if (action === 'start') setIsRunning(true);
      if (action === 'pause') setIsRunning(false);
      if (action === 'restart') {
        // After restart, the server is paused by default.
        // We fetch the fresh state and wait for user to press play.
        setIsRunning(false);
      }
    } catch (err) {
      console.error(`Control action ${action} error:`, err);
      setError(err.message);
    }
  }, []);

  const start = () => sendControlAction('start');
  const pause = () => sendControlAction('pause');
  const restart = () => sendControlAction('restart');

  return { simulationState, error, isRunning, start, pause, restart };
}
