import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, BarChart, Bar } from "recharts";

export default function ThroughputUtilizationKPIs({ throughputData, utilizationData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
      {/* Throughput KPI as LineChart */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-green-300 mb-2">Throughput</h3>
        <div className="text-slate-200 text-sm mb-4">Trains processed per hour/day, passengers</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={throughputData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#34d399" name="Count" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Utilization KPI as BarChart */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-cyan-300 mb-2">Utilization</h3>
        <div className="text-slate-200 text-sm mb-4">Track/route/platform/train utilization</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={utilizationData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#06b6d4" name="%" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
