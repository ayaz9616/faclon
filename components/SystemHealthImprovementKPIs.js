import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export default function SystemHealthImprovementKPIs({ healthData, improvementData, feedbackData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-8">
      {/* System Health KPI */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-indigo-300 mb-2">System Health</h3>
        <div className="text-slate-200 text-sm mb-4">API uptime, error rates</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={healthData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#818cf8" name="%" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Continuous Improvement KPI */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-orange-300 mb-2">Continuous Improvement</h3>
        <div className="text-slate-200 text-sm mb-4">Root cause, improvement tracking</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={improvementData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#fbbf24" name="Count" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* User Feedback KPI */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-lime-300 mb-2">User Feedback</h3>
        <div className="text-slate-200 text-sm mb-4">Operator comments, incident reports</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={feedbackData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#a3e635" name="Count" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
