export function calculateKPIs(trains) {
  if (!Array.isArray(trains)) {
    return { totalDelay: 0, throughput: 0, punctuality: 0 };
  }
  const totalDelay = trains.reduce((sum, t) => sum + ((t.actual_arrival_time || 0) - (t.scheduled_arrival_time || 0)), 0);
  const throughput = trains.length;
  const punctualTrains = trains.filter(t => (t.actual_arrival_time || 0) <= (t.scheduled_arrival_time || 0)).length;
  const punctuality = throughput > 0 ? (punctualTrains / throughput) * 100 : 0;
  return { totalDelay, throughput, punctuality };
}
