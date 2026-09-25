"use client";

import { useState } from "react";

import SocialAccountsManager from "@/components/SocialAccountsManager";

type Settings = {
  enabled: boolean;
  autoGenerate: boolean;
  autoSchedule: boolean;
  autoPublish: boolean;
  autoRegenerate: boolean;
  maxRegenerationAttempts: number;
  postsPerDay: number;
  minimumIntervalMinutes: number;
  postingDays: string;
  postingTimes: string;
  timezone: string;
  similarityThreshold: number;
  threadsUserId: string | null;
  threadsAccessToken: string | null;
  threadsConnected: boolean;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  telegramEnabled: boolean;
};

export default function SettingsClientForm({ initialSettings }: { initialSettings: Settings }) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSaveMessage("Pengaturan otomasi berhasil disimpan!");
      } else {
        setSaveMessage("Gagal menyimpan pengaturan.");
      }
    } catch {
      setSaveMessage("Terjadi kesalahan koneksi.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {saveMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-semibold">
          {saveMessage}
        </div>
      )}

      {/* 1. Master Automation Switches */}
      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-900 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Master Automation Control</h2>
            <p className="text-xs text-slate-400">
              Sakelar utama untuk mengaktifkan atau menjeda seluruh otomasi sistem.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettings((s) => ({ ...s, enabled: !s.enabled }))}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              settings.enabled ? "bg-indigo-600" : "bg-slate-800"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                settings.enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-sm font-medium text-slate-300">Auto Generate Content</span>
            <input
              type="checkbox"
              checked={settings.autoGenerate}
              onChange={(e) => setSettings((s) => ({ ...s, autoGenerate: e.target.checked }))}
              className="w-4 h-4 text-indigo-600 rounded bg-slate-800 border-slate-700"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-sm font-medium text-slate-300">Auto Schedule to Queue</span>
            <input
              type="checkbox"
              checked={settings.autoSchedule}
              onChange={(e) => setSettings((s) => ({ ...s, autoSchedule: e.target.checked }))}
              className="w-4 h-4 text-indigo-600 rounded bg-slate-800 border-slate-700"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-sm font-medium text-slate-300">Auto Publish via Cron</span>
            <input
              type="checkbox"
              checked={settings.autoPublish}
              onChange={(e) => setSettings((s) => ({ ...s, autoPublish: e.target.checked }))}
              className="w-4 h-4 text-indigo-600 rounded bg-slate-800 border-slate-700"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-sm font-medium text-slate-300">Auto Regenerate Failed</span>
            <input
              type="checkbox"
              checked={settings.autoRegenerate}
              onChange={(e) => setSettings((s) => ({ ...s, autoRegenerate: e.target.checked }))}
              className="w-4 h-4 text-indigo-600 rounded bg-slate-800 border-slate-700"
            />
          </label>
        </div>
      </div>

      {/* 2. Posting Rules */}
      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
        <h2 className="text-lg font-bold text-white">Posting Schedule Rules</h2>
        <p className="text-xs text-slate-400">
          Aturan frekuensi dan waktu posting otomatis.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Posts Per Day</label>
            <input
              type="number"
              value={settings.postsPerDay}
              onChange={(e) => setSettings((s) => ({ ...s, postsPerDay: parseInt(e.target.value) || 3 }))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Min Interval (Minutes)</label>
            <input
              type="number"
              value={settings.minimumIntervalMinutes}
              onChange={(e) => setSettings((s) => ({ ...s, minimumIntervalMinutes: parseInt(e.target.value) || 240 }))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Timezone</label>
            <input
              type="text"
              value={settings.timezone}
              onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Target Posting Times (Comma separated)</label>
          <input
            type="text"
            value={settings.postingTimes}
            onChange={(e) => setSettings((s) => ({ ...s, postingTimes: e.target.value }))}
            placeholder="08:00,13:00,19:00"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>
      </div>

      {/* 3. Threads Connection */}
      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
        <h2 className="text-lg font-bold text-white">Threads API Credentials</h2>
        <p className="text-xs text-slate-400">
          Token resmi Meta Threads API untuk publikasi otomatis.
        </p>

        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Threads User ID</label>
            <input
              type="text"
              value={settings.threadsUserId || ""}
              onChange={(e) => setSettings((s) => ({ ...s, threadsUserId: e.target.value }))}
              placeholder="Contoh: 28345423238482705"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Threads Long-Lived Access Token</label>
            <input
              type="password"
              value={settings.threadsAccessToken || ""}
              onChange={(e) => setSettings((s) => ({ ...s, threadsAccessToken: e.target.value }))}
              placeholder="THAAP..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* 4. Telegram Mobile Ingest Bot */}
      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-900 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>✈️</span> Telegram Mobile Ingest Bot
            </h2>
            <p className="text-xs text-slate-400">
              Kirim link produk Shopee langsung dari aplikasi HP ke chat Telegram Bot untuk auto-ingest.
            </p>
          </div>
          <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
            <span>Aktifkan Bot</span>
            <input
              type="checkbox"
              checked={settings.telegramEnabled}
              onChange={(e) => setSettings((s) => ({ ...s, telegramEnabled: e.target.checked }))}
              className="w-4 h-4 text-indigo-600 rounded bg-slate-800 border-slate-700"
            />
          </label>
        </div>

        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Telegram Bot Token (dari @BotFather)</label>
            <input
              type="text"
              value={settings.telegramBotToken || ""}
              onChange={(e) => setSettings((s) => ({ ...s, telegramBotToken: e.target.value }))}
              placeholder="Contoh: 123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Buat bot di Telegram via <strong>@BotFather</strong>, ketik <code>/newbot</code>, lalu salin token yang diberikan ke sini.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Master Chat ID (Opsional / Terisi Otomatis)</label>
            <input
              type="text"
              value={settings.telegramChatId || ""}
              onChange={(e) => setSettings((s) => ({ ...s, telegramChatId: e.target.value }))}
              placeholder="Contoh: 987654321 (Kosongkan bila ingin bot mengenali otomatis saat chat pertama)"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              ID Telegram pribadi Master agar bot hanya menerima perintah dari Master.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-indigo-600/30 cursor-pointer"
        >
          {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
        </button>
      </div>
    </form>
  );
}
