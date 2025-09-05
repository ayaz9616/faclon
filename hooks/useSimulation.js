"use client";
import { useState, useEffect, useCallback } from 'react';

export default function useSimulation() {
  const [networkConfig, setNetworkConfig] = useState(null);
  const [simulationState, setSimulationState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => setNetworkConfig(data))
      .catch(err => setError(err));
  }, []);

  useEffect(() => {
    let interval;
    function fetchState() {
      fetch('/api/state')
        .then(res => res.json())
        .then(data => {
          setSimulationState(data);
          setIsLoading(false);
        })
        .catch(err => setError(err));
    }
    fetchState();
    interval = setInterval(fetchState, 1000);
    return () => clearInterval(interval);
  }, []);

  const injectDisruption = useCallback(async (trainNo, delayMins) => {
    await fetch('/api/disruption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ train_no: trainNo, delay_mins: delayMins })
    });
  }, []);

  return { networkConfig, simulationState, isLoading, error, injectDisruption };
}
