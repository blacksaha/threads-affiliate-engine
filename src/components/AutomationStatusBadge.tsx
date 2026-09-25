"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AutomationStatusBadge({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/toggle", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setEnabled(json.enabled);
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 border-t border-slate-800/80 bg-slate-950/60">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="relative flex h-3 w-3">
            {enabled ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            )}
          </div>
          <div className="text-xs">
            <p className={`font-semibold ${enabled ? "text-slate-200" : "text-amber-400"}`}>
              {enabled ? "AUTOMATION ACTIVE" : "AUTOMATION PAUSED"}
            </p>
            <p className="text-slate-400">{enabled ? "Daemon: Standing By" : "All Crons Halted"}</p>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 transition"
          title="Toggle Automation"
        >
          {loading ? "..." : "⏻"}
        </button>
      </div>
    </div>
  );
}
