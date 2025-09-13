import React from "react";
import PunctualityDelayKPIs from "./PunctualityDelayKPIs";
import ThroughputUtilizationKPIs from "./ThroughputUtilizationKPIs";
import ConflictDisruptionKPIs from "./ConflictDisruptionKPIs";

export default function KPIDashboard({ punctualityData, delayData, throughputData, utilizationData, conflictData, disruptionData }) {
  return (
    <div className="bg-slate-900/80 rounded-xl p-8 shadow-xl w-full mb-8">
      <h2 className="text-2xl font-bold text-white mb-6">Performance Dashboard & KPIs</h2>
      <PunctualityDelayKPIs punctualityData={punctualityData} delayData={delayData} />
      <ThroughputUtilizationKPIs throughputData={throughputData} utilizationData={utilizationData} />
      <ConflictDisruptionKPIs conflictData={conflictData} disruptionData={disruptionData} />
    </div>
  );
}
