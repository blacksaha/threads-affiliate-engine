"use client";

import { useState } from "react";
import { Trash2, Sparkles, Loader2 } from "lucide-react";

export default function ProductCardActions({ productId }: { productId: string }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleGenerate = async () => {
    if (isGenerating || isDeleting) return;
    setIsGenerating(true);
    
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "POST",
      });
      const data = await res.json();
      
      if (data.success) {
        alert("✅ Berhasil generate dan menjadwalkan utas baru!");
        window.location.reload();
      } else {
        alert("❌ Gagal generate utas: " + (data.reason || data.error || "Terjadi kesalahan."));
      }
    } catch (err: any) {
      alert("❌ Terjadi kesalahan sistem: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (isGenerating || isDeleting) return;
    
    if (!confirm("Hapus produk ini beserta semua angle dan post yang terhubung? Tindakan ini tidak bisa dibatalkan.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      
      if (data.success) {
        window.location.reload();
      } else {
        alert("❌ Gagal menghapus: " + (data.error || "Terjadi kesalahan."));
        setIsDeleting(false);
      }
    } catch (err: any) {
      alert("❌ Terjadi kesalahan sistem: " + err.message);
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t-2 border-[#111111]">
      <button
        onClick={handleGenerate}
        disabled={isGenerating || isDeleting}
        className="flex-1 py-2 px-3 bg-white cartoon-btn disabled:opacity-50 text-[10px] font-black flex items-center justify-center gap-1.5"
      >
        {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
        <span>{isGenerating ? "MEMBUAT..." : "GENERATE AI"}</span>
      </button>

      <button
        onClick={handleDelete}
        disabled={isGenerating || isDeleting}
        className="py-2 px-3 bg-rose-400 cartoon-btn disabled:opacity-50 text-white flex items-center justify-center"
        title="Hapus Produk"
      >
        {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 stroke-[3]" />}
      </button>
    </div>
  );
}
