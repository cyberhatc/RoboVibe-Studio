"use client";

import { useEffect } from "react";
import SimulationCanvas from "@/components/SimulationCanvas";
import TopControlBar from "@/components/TopControlBar";
import TelemetryHUD from "@/components/TelemetryHUD";
import ExportModal from "@/components/ExportModal";
import { useSimStore, saveWorkspace, loadWorkspace } from "@/store/useSimStore";
import { readScenarioFromLocation } from "@/utils/urlSerializer";

export default function Page() {
  // Hydrate from ?sim=... share URL, falling back to the auto-saved workspace.
  useEffect(() => {
    const shared = readScenarioFromLocation();
    const persisted = loadWorkspace();
    if (shared) {
      useSimStore.getState().hydrateScenario(shared);
    } else if (persisted && persisted.waypoints.length > 0) {
      useSimStore.getState().hydrateScenario({
        dof: persisted.dof,
        linkLengths: persisted.linkLengths,
        obstacles: persisted.obstacles,
        waypoints: persisted.waypoints,
      });
      useSimStore.setState({ damping: persisted.damping });
    }

    // Auto-save workspace to localStorage on every meaningful change.
    const unsubscribe = useSimStore.subscribe((state) => saveWorkspace(state));
    return unsubscribe;
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#09090b]">
      <SimulationCanvas />
      <TopControlBar />
      <TelemetryHUD />
      <ExportModal />
    </main>
  );
}
