import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, BarChart, Bar } from "recharts";

export default function ConflictDisruptionKPIs({ conflictData, disruptionData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
      {/* Conflict Resolution KPI as LineChart */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-pink-300 mb-2">Conflict Resolution</h3>
        <div className="text-slate-200 text-sm mb-4">Conflicts detected/resolved, resolution time</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={conflictData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#ec4899" name="Count" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Disruption Impact KPI as BarChart */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-300 mb-2">Disruption Impact</h3>
        <div className="text-slate-200 text-sm mb-4">Disruptions, affected trains</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={disruptionData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#f87171" name="Count" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
