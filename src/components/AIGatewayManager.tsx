"use client";

import { useState, useEffect } from "react";
import { useUI } from "@/components/ui/ModalProvider";

export type GatewayKey = {
  id: string;
  name: string;
  provider: "GEMINI" | "DEEPSEEK" | "OPENAI" | "CUSTOM";
  apiKey: string;
  baseUrl?: string | null;
  modelName: string;
  modelType: string;
  metadata?: any;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function AIGatewayManager() {
  const { toast, confirm } = useUI();
  const [gateways, setGateways] = useState<GatewayKey[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Modal State (Add or Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<"GEMINI" | "DEEPSEEK" | "OPENAI" | "CUSTOM">("GEMINI");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelName, setModelName] = useState("gemini-2.0-flash");
  const [priority, setPriority] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);

  // Visibility of API Keys per item
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  // Live Testing status per gateway
  const [testStatus, setTestStatus] = useState<
    Record<string, { loading: boolean; success?: boolean; message?: string; latencyMs?: number }>
  >({});

  const fetchGateways = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/gateways");
      if (res.ok) {
        const data = await res.json();
        setGateways(data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat daftar API Key Gateway");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGateways();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setName("");
    setProvider("GEMINI");
    setApiKey("");
    setBaseUrl("");
    setModelName("gemini-2.0-flash");
    setPriority(gateways.length);
    setIsActive(true);
    setModalOpen(true);
  };

  const openEditModal = (gw: GatewayKey) => {
    setEditingId(gw.id);
    setName(gw.name);
    setProvider(gw.provider);
    setApiKey(gw.apiKey);
    setBaseUrl(gw.baseUrl || "");
    setModelName(gw.modelName || "");
    setPriority(gw.priority);
    setIsActive(gw.isActive);
    setModalOpen(true);
  };

  const handleProviderChange = (newProvider: "GEMINI" | "DEEPSEEK" | "OPENAI" | "CUSTOM") => {
    setProvider(newProvider);
    if (newProvider === "GEMINI") {
      setModelName("gemini-2.0-flash");
      setBaseUrl("");
    } else if (newProvider === "DEEPSEEK") {
      setModelName("deepseek-chat");
      setBaseUrl("https://api.deepseek.com");
    } else if (newProvider === "OPENAI") {
      setModelName("gpt-4o-mini");
      setBaseUrl("https://api.openai.com/v1");
    } else if (newProvider === "CUSTOM") {
      setModelName("vikey-ai-model");
      setBaseUrl("https://vikey.ai/v1");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !apiKey.trim()) {
      toast.error("Nama Gateway dan API Key wajib diisi!");
      return;
    }

    try {
      const payload = {
        id: editingId,
        name: name.trim(),
        provider,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim() || null,
        modelName: modelName.trim(),
        priority: Number(priority),
        isActive,
      };

      const res = await fetch("/api/gateways", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal menyimpan konfigurasi");
        return;
      }

      toast.success(
        editingId ? "Gateway API Key berhasil diperbarui!" : "Gateway API Key baru berhasil ditambahkan!",
        "Tersimpan"
      );
      setModalOpen(false);
      fetchGateways();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan sistem");
    }
  };

  const handleDelete = async (id: string, gatewayName: string) => {
    const ok = await confirm({
      title: "Hapus Gateway AI?",
      message: `Apakah Master yakin ingin menghapus gateway "${gatewayName}"? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: "Hapus Sekarang",
      cancelText: "Batal",
      isDestructive: true,
    });

    if (!ok) return;

    try {
      const res = await fetch(`/api/gateways?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`Gateway "${gatewayName}" berhasil dihapus.`);
        setGateways((prev) => prev.filter((g) => g.id !== id));
      } else {
        const data = await res.json();
        toast.error(data.error || "Gagal menghapus gateway");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus gateway");
    }
  };

  const handleToggleActive = async (gw: GatewayKey) => {
    const nextState = !gw.isActive;
    // Optimistic UI update
    setGateways((prev) => prev.map((g) => (g.id === gw.id ? { ...g, isActive: nextState } : g)));

    try {
      const res = await fetch("/api/gateways", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: gw.id, isActive: nextState }),
      });
      if (!res.ok) {
        // Rollback
        setGateways((prev) => prev.map((g) => (g.id === gw.id ? { ...g, isActive: gw.isActive } : g)));
        toast.error("Gagal mengubah status aktif");
      } else {
        toast.success(`Gateway ${gw.name} kini ${nextState ? "AKTIF" : "NONAKTIF"}`);
      }
    } catch {
      setGateways((prev) => prev.map((g) => (g.id === gw.id ? { ...g, isActive: gw.isActive } : g)));
    }
  };

  const handleTestConnection = async (gw: GatewayKey) => {
    setTestStatus((prev) => ({
      ...prev,
      [gw.id]: { loading: true },
    }));

    try {
      const res = await fetch("/api/gateways/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: gw.provider,
          apiKey: gw.apiKey,
          baseUrl: gw.baseUrl,
          modelName: gw.modelName,
        }),
      });

      const data = await res.json();
      setTestStatus((prev) => ({
        ...prev,
        [gw.id]: {
          loading: false,
          success: data.success,
          message: data.success ? data.message : (data.error || "Gagal terhubung ke API gateway."),
          latencyMs: data.latencyMs,
        },
      }));
    } catch (err: any) {
      setTestStatus((prev) => ({
        ...prev,
        [gw.id]: {
          loading: false,
          success: false,
          message: err.message || "Koneksi ke gateway timeout atau gagal.",
        },
      }));
    }
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("API Key disalin ke clipboard!");
  };

  const getProviderBadge = (p: string) => {
    switch (p) {
      case "GEMINI":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">Google Gemini</span>;
      case "DEEPSEEK":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">DeepSeek</span>;
      case "OPENAI":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">OpenAI</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">Custom Gateway</span>;
    }
  };

  const maskApiKey = (key: string, isVisible: boolean) => {
    if (isVisible) return key;
    if (key.length <= 10) return "••••••••••••";
    return `${key.substring(0, 6)}••••••••${key.substring(key.length - 4)}`;
  };

  return (
    <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🤖</span> AI Gateways & Multi-Model API Keys
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              {gateways.filter((g) => g.isActive).length} Aktif / {gateways.length} Terdaftar
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Daftar API Key AI multi-model & gateway (Gemini, DeepSeek, OpenAI, CleveCode, vikey.ai). Sistem akan memanggil gateway berurutan sesuai prioritas dan otomatis failover jika terjadi limit/error.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-indigo-600/30 cursor-pointer shrink-0"
        >
          <span>➕</span> Tambah Gateway Baru
        </button>
      </div>

      {/* List Gateways */}
      {loading ? (
        <div className="p-8 text-center text-slate-400 text-sm">
          <div className="inline-block animate-spin mr-2">⏳</div> Memuat daftar API Key...
        </div>
      ) : gateways.length === 0 ? (
        <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center bg-slate-900/40 space-y-3">
          <div className="text-3xl">🔑</div>
          <p className="text-sm font-semibold text-slate-300">Belum Ada API Key Gateway Tambahan</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Sistem saat ini menggunakan konfigurasi default serverless. Tambahkan satu atau beberapa API Key dari Google Gemini, DeepSeek, atau gateway custom Anda sendiri untuk rotasi bebas limit!
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>➕</span> Tambah API Key Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {gateways.map((gw) => {
            const isVisible = !!visibleKeys[gw.id];
            const test = testStatus[gw.id];

            return (
              <div
                key={gw.id}
                className={`p-4 rounded-xl border transition ${
                  gw.isActive
                    ? "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                    : "bg-slate-950/60 border-slate-900 opacity-60"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Left: Info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white text-sm">{gw.name}</span>
                      {getProviderBadge(gw.provider)}
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                        {gw.modelName || "Default Model"}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800/80 text-indigo-300">
                        Prioritas #{gw.priority}
                      </span>
                    </div>

                    {gw.baseUrl && (
                      <p className="text-[11px] text-slate-400 font-mono truncate">
                        <span className="text-slate-500">Base URL:</span> {gw.baseUrl}
                      </p>
                    )}

                    {/* Masked Key Display with Show/Hide & Copy */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 font-medium">Key:</span>
                      <code className="font-mono text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px] select-all">
                        {maskApiKey(gw.apiKey, isVisible)}
                      </code>
                      <button
                        type="button"
                        onClick={() => toggleKeyVisibility(gw.id)}
                        className="text-slate-400 hover:text-slate-200 transition text-xs p-1"
                        title={isVisible ? "Sembunyikan" : "Tampilkan"}
                      >
                        {isVisible ? "🙈" : "👁️"}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(gw.apiKey)}
                        className="text-slate-400 hover:text-slate-200 transition text-xs p-1"
                        title="Salin Key"
                      >
                        📋
                      </button>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/60">
                    {/* Active Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(gw)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        gw.isActive ? "bg-indigo-600" : "bg-slate-800"
                      }`}
                      title={gw.isActive ? "Nonaktifkan Gateway" : "Aktifkan Gateway"}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          gw.isActive ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>

                    {/* Test Button */}
                    <button
                      type="button"
                      disabled={test?.loading}
                      onClick={() => handleTestConnection(gw)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                    >
                      {test?.loading ? (
                        <>
                          <span className="inline-block animate-spin">⏳</span> Testing...
                        </>
                      ) : (
                        <>
                          <span>⚡</span> Test
                        </>
                      )}
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => openEditModal(gw)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>✏️</span> Edit
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleDelete(gw.id, gw.name)}
                      className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg border border-rose-500/20 transition cursor-pointer"
                      title="Hapus Gateway"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Test Result Message Box */}
                {test && !test.loading && (
                  <div
                    className={`mt-3 p-2.5 rounded-lg text-xs font-medium flex items-start gap-2 ${
                      test.success
                        ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                        : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                    }`}
                  >
                    <span>{test.success ? "✅" : "❌"}</span>
                    <div className="flex-1">
                      <p>{test.message}</p>
                      {test.latencyMs && (
                        <p className="text-[10px] text-slate-400 mt-0.5">Waktu respon: {test.latencyMs}ms</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Tambah / Edit Gateway */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{editingId ? "✏️" : "➕"}</span>
                <span>{editingId ? "Edit AI Gateway Key" : "Tambah AI Gateway Key Baru"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Nama Gateway */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama Label Gateway <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Gemini Flash 2.0 Cadangan, DeepSeek CleveCode, vikey.ai"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Provider Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Provider / Model Architecture <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["GEMINI", "DEEPSEEK", "OPENAI", "CUSTOM"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleProviderChange(p)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition text-center cursor-pointer ${
                        provider === p
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      {p === "GEMINI" ? "Gemini" : p === "DEEPSEEK" ? "DeepSeek" : p === "OPENAI" ? "OpenAI" : "Custom"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama Model (Model ID) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder={
                    provider === "GEMINI"
                      ? "gemini-2.0-flash / gemini-1.5-flash"
                      : provider === "DEEPSEEK"
                      ? "deepseek-chat / deepseek-reasoner"
                      : provider === "OPENAI"
                      ? "gpt-4o-mini / gpt-4o"
                      : "deepseek-v4.1-flash / custom-model-id"
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {(provider === "GEMINI"
                    ? ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-flash-latest"]
                    : provider === "DEEPSEEK"
                    ? ["deepseek-chat", "deepseek-reasoner", "deepseek-v4.1-flash"]
                    : provider === "OPENAI"
                    ? ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"]
                    : ["deepseek-v4.1-flash", "deepseek-v4-pro-0813", "glm-5.1"]
                  ).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModelName(m)}
                      className="px-2 py-0.5 bg-slate-950 hover:bg-slate-800 text-[10px] text-slate-400 hover:text-slate-200 rounded border border-slate-800 cursor-pointer"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Base URL (Shown for DeepSeek, OpenAI, Custom) */}
              {provider !== "GEMINI" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Base URL / Proxy Gateway Endpoint
                  </label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder={
                      provider === "DEEPSEEK"
                        ? "https://api.deepseek.com"
                        : provider === "OPENAI"
                        ? "https://api.openai.com/v1"
                        : "https://vikey.ai/v1 atau proxy Anda"
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Gunakan Base URL gateway seperti vikey.ai, CleveCode, atau OpenRouter (OpenAI-compatible).
                  </p>
                </div>
              )}

              {/* API Key */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  API Key Secret Token <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    provider === "GEMINI"
                      ? "AIzaSy..."
                      : provider === "DEEPSEEK"
                      ? "sk-..."
                      : "sk-..."
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Priority & Active Switch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tingkat Prioritas (Priority Order)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">0 = Prioritas Pertama (Utama), 1 = Cadangan, dst.</p>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                    <span className="text-xs font-semibold text-slate-300">Status Aktif</span>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded bg-slate-800 border-slate-700 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  {editingId ? "Simpan Perubahan" : "Simpan Gateway"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
