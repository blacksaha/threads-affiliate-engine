"use client";

import { useState, useEffect } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  stats?: {
    products: number;
    totalPosts: number;
    published: number;
    scheduled: number;
    accounts: number;
    automationEnabled: boolean;
  };
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("USER");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/stats");
      const json = await res.json();
      if (json.success) {
        setUsers(json.users);
        setSummary(json.summary);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetPassword = async (id: string) => {
    const newPassword = prompt("Masukkan password baru untuk user ini:");
    if (!newPassword) return;
    try {
      await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      alert("Password berhasil direset!");
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage("✅ User baru berhasil dibuat!");
        setName("");
        setEmail("");
        setPassword("");
        fetchUsers();
      } else {
        setMessage(`❌ ${data.error || "Gagal membuat user"}`);
      }
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🛡️</span> Admin Console & User Management
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Kelola akses multi-user untuk sistem affiliate engine. Setiap pengguna dapat memiliki kredensial masing-masing.
        </p>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Users</p>
            <p className="text-2xl font-black text-white mt-1">{summary.totalUsers}</p>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <p className="text-[10px] uppercase font-bold text-slate-400">User Aktif</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{summary.activeUsers}</p>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <p className="text-[10px] uppercase font-bold text-slate-400">User Nonaktif</p>
            <p className="text-2xl font-black text-rose-400 mt-1">{summary.inactiveUsers}</p>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Post</p>
            <p className="text-2xl font-black text-indigo-400 mt-1">{summary.totalPosts}</p>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Terbit</p>
            <p className="text-2xl font-black text-teal-400 mt-1">{summary.totalPublished}</p>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Jadwal</p>
            <p className="text-2xl font-black text-amber-400 mt-1">{summary.totalScheduled}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Form Create User */}
        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-lg font-bold text-white">+ Tambah User Baru</h2>

          {message && (
            <div className="p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white">
              {message}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Lengkap</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Misal: Budi Santoso"
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@domain.com"
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Role / Peran</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="USER">User (Standard Access)</option>
                <option value="ADMIN">Admin (Full Access + Console)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition"
            >
              {loading ? "Menyimpan..." : "Daftarkan User"}
            </button>
          </form>
        </div>

        {/* User List Table */}
        <div className="md:col-span-2 bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-lg font-bold text-white">Daftar Pengguna Terdaftar ({users.length})</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-4">Role & Status</th>
                  <th className="py-3 px-4">Produk</th>
                  <th className="py-3 px-4">Konten (Terbit / Antre)</th>
                  <th className="py-3 px-4">Sosmed</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-900/30 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{u.name || "-"}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.role === "ADMIN"
                              ? "bg-purple-950 text-purple-300 border border-purple-800"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {u.role}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            u.status === "ACTIVE"
                              ? "text-emerald-400 bg-emerald-950/40"
                              : "text-rose-400 bg-rose-950/40"
                          }`}
                        >
                          {u.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-200">
                      {u.stats?.products ?? 0}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className="text-emerald-400 font-bold">{u.stats?.published ?? 0}</span>
                      {" / "}
                      <span className="text-amber-400 font-bold">{u.stats?.scheduled ?? 0}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {u.stats?.accounts ?? 0} akun
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleToggleStatus(u.id, u.status)}
                        className={`px-2 py-1 text-[10px] font-bold rounded border transition ${
                          u.status === "ACTIVE"
                            ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20"
                            : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {u.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button
                        onClick={() => handleResetPassword(u.id)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded border border-slate-700 transition"
                      >
                        Reset Password
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
