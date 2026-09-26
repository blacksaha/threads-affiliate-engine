"use client";

import { useState, useEffect } from "react";

type Account = {
  id: string;
  platform: string;
  name: string;
  accountId: string;
  accessToken: string;
  isActive: boolean;
};

export default function SocialAccountsManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [platform, setPlatform] = useState("THREADS");
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { loading?: boolean; success?: boolean; message?: string }>>({});

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/accounts");
      const json = await res.json();
      if (json.success) setAccounts(json.accounts);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleTest = async (id: string) => {
    setTestResults((prev) => ({ ...prev, [id]: { loading: true } }));
    try {
      const res = await fetch("/api/accounts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          loading: false,
          success: data.success,
          message: data.success ? data.message : (data.error || "Gagal terkoneksi."),
        },
      }));
    } catch (e: any) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { loading: false, success: false, message: e.message },
      }));
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, name, accountId, accessToken, refreshToken })
      });
      const json = await res.json();
      if (json.success) {
        setName("");
        setAccountId("");
        setAccessToken("");
        setRefreshToken("");
        fetchAccounts();
      } else {
        alert(json.error || "Gagal menambah akun");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus akun ini dari sistem?")) return;
    try {
      const res = await fetch(`/api/accounts?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) fetchAccounts();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>👥</span> Multi-Account Manager (Threads, X, Facebook)
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Hubungkan banyak akun Threads atau platform lain untuk rotasi posting dan distribusi konten massal.
        </p>
      </div>

      {/* Account List */}
      <div className="space-y-3">
        {accounts.length === 0 ? (
          <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800/80 text-center text-xs text-slate-400">
            Belum ada akun tambahan terdaftar. Gunakan formulir di bawah untuk mendaftarkan akun Threads kedua, X, atau Facebook.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          acc.platform === "THREADS"
                            ? "bg-purple-950 text-purple-300 border border-purple-800"
                            : acc.platform === "X"
                            ? "bg-slate-800 text-slate-200 border border-slate-700"
                            : "bg-blue-950 text-blue-300 border border-blue-800"
                        }`}
                      >
                        {acc.platform}
                      </span>
                      <span className="text-sm font-semibold text-white">{acc.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">ID: {acc.accountId}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTest(acc.id)}
                      disabled={testResults[acc.id]?.loading}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-semibold rounded-lg border border-slate-600 transition"
                    >
                      {testResults[acc.id]?.loading ? "Menguji..." : "⚡ Test"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(acc.id)}
                      className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg border border-rose-500/20 transition"
                    >
                      Hapus
                    </button>
                  </div>
                </div>

                {/* Test Result Feedback */}
                {testResults[acc.id] && !testResults[acc.id].loading && (
                  <div
                    className={`p-2.5 rounded-lg border text-xs ${
                      testResults[acc.id].success
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    }`}
                  >
                    {testResults[acc.id].success ? "✅ " : "❌ "}
                    {testResults[acc.id].message}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Account Form */}
      <form onSubmit={handleAdd} className="pt-4 border-t border-slate-900 space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          + Daftarkan Akun Baru
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="THREADS">Threads (Meta)</option>
              <option value="X">X (Twitter)</option>
              <option value="FACEBOOK">Facebook Page</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Label / Nama Akun</label>
            <input
              type="text"
              required
              placeholder="Contoh: Threads Cadangan / Akun Niche"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Account ID / User ID / Page ID</label>
            <input
              type="text"
              required
              placeholder="User ID Threads atau Page ID FB"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Long-Lived Access Token</label>
          <input
            type="password"
            required
            placeholder="Token resmi platform..."
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        {platform === "X" && (
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">OAuth 2.0 Refresh Token (Opsional)</label>
            <input
              type="password"
              placeholder="Refresh token untuk X (berlaku 6 bulan)..."
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-1">Jika diisi, bot akan otomatis merefresh Access Token X setiap 2 jam. Pastikan Account ID diisi dengan Client ID App Anda.</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition shadow-md shadow-indigo-600/20"
        >
          {loading ? "Menyimpan..." : "+ Hubungkan Akun"}
        </button>
      </form>
    </div>
  );
}
