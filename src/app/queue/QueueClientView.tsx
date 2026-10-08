"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Trash2, RotateCw, Eye, EyeOff, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useUI } from "@/components/ui/ModalProvider";

type Post = {
  id: string;
  status: string;
  hook: string | null;
  body: string | null;
  cta: string | null;
  content: string;
  xContent?: string | null;
  fbContent?: string | null;
  qualityScore: number | null;
  similarityScore: number | null;
  scheduledAt: Date | string | null;
  product: { name: string; price: string };
  angle: { angleType: string } | null;
  lastError: string | null;
};

const statusBadges: Record<string, string> = {
  GENERATING: "bg-purple-200 text-purple-900 border-[#111111]",
  VALIDATING: "bg-blue-200 text-blue-900 border-[#111111]",
  READY: "bg-teal-200 text-teal-900 border-[#111111]",
  SCHEDULED: "bg-amber-200 text-amber-900 border-[#111111]",
  PUBLISHING: "bg-orange-300 text-orange-950 border-[#111111]",
  PUBLISHED: "bg-emerald-300 text-emerald-950 border-[#111111]",
  FAILED: "bg-rose-300 text-rose-950 border-[#111111]",
  CANCELLED: "bg-gray-200 text-gray-800 border-[#111111]",
};

export default function QueueClientView({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();
  const { toast, confirm } = useUI();

  const postsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(posts.length / postsPerPage));
  const startIndex = (currentPage - 1) * postsPerPage;
  const visiblePosts = posts.slice(startIndex, startIndex + postsPerPage);

  // If we delete the last item on a page, handle going back a page
  if (currentPage > totalPages) {
    setCurrentPage(totalPages);
  }

  async function handleAction(postId: string, action: string) {
    if (action === "delete") {
      const isConfirmed = await confirm({
        title: "Hapus Konten",
        message: "Hapus draft konten ini dari antrean? Tindakan ini tidak bisa dibatalkan.",
        confirmText: "Ya, Hapus!",
        isDestructive: true,
      });
      if (!isConfirmed) return;
    } else if (action === "regenerate") {
      toast.info("Bot sedang menulis ulang naskah baru untuk produk ini...", "Menulis Ulang");
    } else if (action === "publish_now") {
      toast.info("Sedang menerbitkan postingan ke Threads & media sosial...", "Menerbitkan");
    }
    
    try {
      if (action === "cancel") {
        await fetch(`/api/posts/${postId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "CANCELLED" }),
        });
        toast.info("Jadwal publikasi berhasil dibatalkan.", "Dibatalkan");
      } else if (action === "delete") {
        await fetch(`/api/posts/${postId}`, { method: "DELETE" });
        toast.success("Draft konten berhasil dihapus.", "Terhapus");
      } else if (action === "regenerate") {
        await fetch(`/api/posts/${postId}`, { method: "POST" });
        toast.success("Naskah sedang digenerate ulang di antrean background!", "Selesai");
      } else if (action === "publish_now") {
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, status: "PUBLISHING" } : p));
        const res = await fetch(`/api/posts/${postId}/publish`, { method: "POST" });
        const json = await res.json();
        if (json.success) {
          toast.success("Utas berhasil diterbitkan ke Threads & Platform lain!", "Berhasil Tayang!");
          setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, status: "PUBLISHED" } : p));
        } else {
          toast.error(`Gagal mempublish: ${json.error}`, "Gagal Tayang");
          setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, status: "FAILED", lastError: json.error } : p));
        }
      }
      
      router.refresh();
      if (action === "cancel") {
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, status: "CANCELLED" } : p));
      } else if (action === "delete") {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Aksi gagal karena kesalahan teknis.", "Gagal");
    }
  }

  return (
    <div className="space-y-4">
      {posts.length === 0 ? (
        <div className="cartoon-card bg-white p-12 text-center">
          <p className="font-bold text-gray-700">Antrean konten masih kosong.</p>
        </div>
      ) : (
        <>
          {visiblePosts.map((post) => {
            const isExpanded = expandedId === post.id;
            let chain: string[] = [];
          try {
            chain = JSON.parse(post.content || "[]");
          } catch {
            chain = [];
          }

          return (
            <div key={post.id} className="cartoon-card bg-white p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`cartoon-badge px-2.5 py-0.5 text-[10px] ${
                        statusBadges[post.status] || statusBadges.READY
                      }`}
                    >
                      {post.status}
                    </span>
                    <span className="text-xs font-black text-black">
                      {post.product.name}
                    </span>
                    <span className="text-xs font-bold text-gray-500">
                      ({post.angle?.angleType || "General"})
                    </span>
                  </div>

                  <p className="text-sm font-bold text-gray-900 italic line-clamp-2">
                    &quot;{post.hook}&quot;
                  </p>

                  <div className="flex items-center gap-3 text-[11px] font-bold text-gray-600 flex-wrap">
                    <span>Quality: <strong className="text-black">{post.qualityScore?.toFixed(2) ?? "-"}</strong></span>
                    <span>•</span>
                    <span>Jadwal: <strong className="text-black">
                      {post.scheduledAt
                        ? new Date(post.scheduledAt).toLocaleString("id-ID", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Belum dijadwalkan"}
                    </strong></span>
                  </div>

                  {post.status === "FAILED" && post.lastError && (
                    <div className="cartoon-card bg-rose-100 p-2 text-xs font-bold text-rose-800">
                      Error: {post.lastError}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : post.id)}
                    className="cartoon-btn px-3 py-2 bg-gray-100 hover:bg-gray-200 text-black text-xs flex items-center gap-1"
                  >
                    {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {isExpanded ? "Tutup" : "Lihat Naskah"}
                  </button>
                  
                  {post.status === "SCHEDULED" && (
                    <button
                      onClick={() => handleAction(post.id, "cancel")}
                      className="cartoon-btn px-3 py-2 bg-amber-200 hover:bg-amber-300 text-black text-xs flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Batal
                    </button>
                  )}

                  {post.status !== "PUBLISHED" && (
                    <button
                      onClick={() => handleAction(post.id, "publish_now")}
                      className="cartoon-btn px-3 py-2 bg-emerald-300 hover:bg-emerald-400 text-black text-xs flex items-center gap-1"
                    >
                      <Zap className="w-3.5 h-3.5 fill-black" />
                      Post Sekarang
                    </button>
                  )}

                  <button
                    onClick={() => handleAction(post.id, "regenerate")}
                    className="cartoon-btn px-3 py-2 bg-blue-200 hover:bg-blue-300 text-black text-xs flex items-center gap-1"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Tulis Ulang
                  </button>

                  <button
                    onClick={() => handleAction(post.id, "delete")}
                    className="cartoon-btn px-3 py-2 bg-rose-200 hover:bg-rose-300 text-black text-xs"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded Draft View */}
              {isExpanded && (
                <div className="pt-4 border-t-2 border-gray-100 space-y-4">
                  {/* Threads Section */}
                  <div>
                    <h3 className="text-xs font-black text-black uppercase mb-3">
                      🧵 Format Utas Threads ({chain.length} Rantai)
                    </h3>
                    <div className="space-y-2">
                      {chain.map((text, idx) => (
                        <div key={idx} className="cartoon-card border-2 bg-bg p-3 text-xs font-bold text-black">
                          <span className="cartoon-badge bg-white px-2 py-0.5 text-[9px] mr-2">
                            Post {idx + 1}
                          </span>
                          {text}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Multi-Platform (X & FB) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div className="cartoon-card bg-amber-50 p-3 space-y-1">
                      <span className="text-[10px] font-black text-black uppercase">𝕏 Format X (Twitter)</span>
                      <p className="text-xs font-bold text-gray-800 whitespace-pre-wrap">
                        {post.xContent || post.hook || "Belum ada format X."}
                      </p>
                    </div>

                    <div className="cartoon-card bg-blue-50 p-3 space-y-1">
                      <span className="text-[10px] font-black text-blue-900 uppercase">🌐 Format Facebook Page</span>
                      <p className="text-xs font-bold text-gray-800 whitespace-pre-wrap">
                        {post.fbContent || (post.body ? `${post.hook}\n\n${post.body}\n\n${post.cta}` : "Belum ada format FB.")}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </>
      )}

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4 pb-8 flex-wrap">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={`cartoon-btn px-4 py-2 flex items-center gap-1 text-xs font-black border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] uppercase ${
              currentPage === 1 ? "bg-gray-200 text-gray-400 cursor-not-allowed opacity-60" : "bg-white hover:bg-gray-100 text-black"
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Sebelumnya
          </button>

          <div className="flex items-center gap-1.5 flex-wrap">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1.5 text-xs font-black border-[3px] border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase transition-all ${
                      currentPage === page
                        ? "bg-[#ffb347] text-black scale-105"
                        : "bg-white text-black hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                );
              }
              if (page === currentPage - 2 || page === currentPage + 2) {
                return <span key={page} className="text-xs font-black text-black px-1">...</span>;
              }
              return null;
            })}
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={`cartoon-btn px-4 py-2 flex items-center gap-1 text-xs font-black border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] uppercase ${
              currentPage === totalPages ? "bg-gray-200 text-gray-400 cursor-not-allowed opacity-60" : "bg-white hover:bg-gray-100 text-black"
            }`}
          >
            Selanjutnya
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
