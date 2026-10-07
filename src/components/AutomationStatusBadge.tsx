"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Power } from "lucide-react";

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
    <div className="p-4 border-t-3 border-[#111111] bg-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="relative flex h-4 w-4">
            {enabled ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-[#111111]"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-400 border-2 border-[#111111]"></span>
            )}
          </div>
          <div className="text-xs">
            <p className="font-black text-black">
              {enabled ? "BOT AKTIF" : "BOT JEDA"}
            </p>
            <p className="text-[10px] font-bold text-gray-500">
              {enabled ? "Daemon Standby" : "Jadwal Berhenti"}
            </p>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          className={`cartoon-btn p-2 text-xs flex items-center justify-center ${
            enabled ? "bg-emerald-300 hover:bg-emerald-400" : "bg-gray-200 hover:bg-gray-300"
          }`}
          title="Toggle Automation"
        >
          <Power className="w-4 h-4 stroke-[3]" />
        </button>
      </div>
    </div>
  );
}
