import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, CartesianGrid, XAxis, YAxis } from "recharts";

export default function PunctualityDelayKPIs({ punctualityData, delayData }) {
  const pieColors = ["#60a5fa", "#f87171", "#facc15", "#34d399"];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
      {/* Punctuality KPI as PieChart */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-300 mb-2">Punctuality</h3>
        <div className="text-slate-200 text-sm mb-4">% of trains on time, late arrivals, etc.</div>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={punctualityData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80} label>
              {punctualityData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={pieColors[idx % pieColors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Delay KPI as LineChart */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-yellow-300 mb-2">Delay Metrics</h3>
        <div className="text-slate-200 text-sm mb-4">Mean, median, max, min delay (min)</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={delayData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#facc15" name="Minutes" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
