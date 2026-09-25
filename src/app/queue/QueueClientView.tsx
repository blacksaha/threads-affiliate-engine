"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Tipe data berdasarkan Prisma Schema (ContentPost & Product & Angle)
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

const statusColors: Record<string, string> = {
  GENERATING: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  VALIDATING: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  READY: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  SCHEDULED: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  PUBLISHING: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  PUBLISHED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  FAILED: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  CANCELLED: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export default function QueueClientView({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();

  async function handleAction(postId: string, action: string) {
    if (action === "delete" && !confirm("Delete this content?")) return;
    
    try {
      if (action === "cancel") {
        await fetch(`/api/posts/${postId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "CANCELLED" }),
        });
      } else if (action === "delete") {
        await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      } else if (action === "regenerate") {
        alert("Bot is regenerating new content chain for this product in the background!");
        await fetch(`/api/posts/${postId}`, { method: "POST" });
      } else if (action === "publish_now") {
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, status: "PUBLISHING" } : p));
        const res = await fetch(`/api/posts/${postId}/publish`, { method: "POST" });
        const json = await res.json();
        if (json.success) {
          alert("Utas berhasil diterbitkan ke Threads!");
          setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, status: "PUBLISHED" } : p));
        } else {
          alert(`Gagal mempublish: ${json.error}`);
          setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, status: "FAILED", lastError: json.error } : p));
        }
      }
      
      router.refresh();
      // Optimistic update for simple state changes
      if (action === "cancel") {
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, status: "CANCELLED" } : p));
      } else if (action === "delete") {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } catch (err) {
      console.error(err);
      alert("Action failed.");
    }
  }

  return (
    <div className="space-y-6">
      {posts.length === 0 ? (
        <div className="bg-slate-950 p-12 rounded-2xl border border-slate-800 text-center">
          <p className="text-slate-400">Antrean konten masih kosong.</p>
        </div>
      ) : (
        posts.map((post) => {
          const isExpanded = expandedId === post.id;
          let chain: string[] = [];
          try {
            chain = JSON.parse(post.content || "[]");
          } catch {
            chain = [];
          }

          return (
            <div key={post.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center space-x-3">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        statusColors[post.status] || statusColors.READY
                      }`}
                    >
                      {post.status}
                    </span>
                    <span className="text-xs font-semibold text-slate-300">
                      Product: <span className="text-white">{post.product.name}</span>
                    </span>
                    <span className="text-xs text-slate-500">|</span>
                    <span className="text-xs text-slate-400">
                      Angle: {post.angle?.angleType || "General"}
                    </span>
                  </div>

                  <p className="text-sm text-slate-200 line-clamp-2 italic font-serif">
                    &quot;{post.hook}&quot;
                  </p>

                  <div className="flex items-center space-x-4 text-xs font-mono text-slate-500">
                    <span className={post.qualityScore && post.qualityScore > 0.8 ? "text-emerald-400" : ""}>
                      Quality: {post.qualityScore?.toFixed(2) ?? "-"}
                    </span>
                    <span className={post.similarityScore && post.similarityScore < 0.3 ? "text-emerald-400" : ""}>
                      Similarity: {post.similarityScore?.toFixed(2) ?? "-"}
                    </span>
                    <span>
                      Scheduled:{" "}
                      <strong className="text-indigo-400">
                        {post.scheduledAt
                          ? new Date(post.scheduledAt).toLocaleString("id-ID", {
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Unscheduled"}
                      </strong>
                    </span>
                  </div>

                  {post.status === "FAILED" && post.lastError && (
                    <div className="mt-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-400">
                      <strong>Error:</strong> {post.lastError}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap md:flex-col gap-2 shrink-0">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : post.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition"
                  >
                    {isExpanded ? "Hide Draft" : "View Full Draft"}
                  </button>
                  
                  {post.status === "SCHEDULED" && (
                    <button
                      onClick={() => handleAction(post.id, "cancel")}
                      className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-xs font-medium rounded-lg transition border border-amber-500/20"
                    >
                      Cancel Schedule
                    </button>
                  )}

                  {post.status !== "PUBLISHED" && (
                    <button
                      onClick={() => handleAction(post.id, "publish_now")}
                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg transition border border-emerald-500/20 cursor-pointer"
                    >
                      ⚡ Publish Now (All Platforms)
                    </button>
                  )}

                  <button
                    onClick={() => handleAction(post.id, "regenerate")}
                    className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-medium rounded-lg transition border border-indigo-500/20"
                  >
                    Regenerate Alternative
                  </button>

                  <button
                    onClick={() => handleAction(post.id, "delete")}
                    className="px-3 py-1.5 hover:bg-rose-500/10 text-rose-500 text-xs font-medium rounded-lg transition"
                  >
                    Delete Post
                  </button>
                </div>
              </div>

              {/* Expanded Multi-Platform View */}
              {isExpanded && (
                <div className="mt-6 pt-6 border-t border-slate-800 space-y-6">
                  {/* Threads Section */}
                  <div>
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span>🧵</span> Format Threads ({chain.length} Rantai Utas)
                    </h3>
                    <div className="relative pl-6 space-y-4 before:absolute before:inset-y-0 before:left-2 before:w-0.5 before:bg-slate-800">
                      {chain.map((text, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-6 w-4 h-4 rounded-full bg-slate-900 border-2 border-indigo-500 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                          </div>
                          <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-sm text-slate-200 whitespace-pre-wrap">
                            {text}
                          </div>
                          <div className="mt-1 ml-2 text-[10px] text-slate-500 uppercase font-semibold">
                            {idx === 0 ? "Post 1 (Hook)" : idx === 1 ? "Post 2 (Story)" : idx === 2 ? "Post 3 (Review/Image)" : "Post 4 (CTA/Link)"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Multi-Platform Adapter Section (X & Facebook) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-900">
                    {/* X (Twitter) */}
                    <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <span>𝕏</span> Format X (Twitter)
                        </span>
                        <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">Ringkas + Link</span>
                      </div>
                      <div className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800/80 whitespace-pre-wrap font-sans">
                        {post.xContent || post.hook || "Belum di-generate untuk X."}
                      </div>
                    </div>

                    {/* Facebook Page */}
                    <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                          <span>🌐</span> Format Facebook Page
                        </span>
                        <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">1 Postingan Penuh</span>
                      </div>
                      <div className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800/80 whitespace-pre-wrap font-sans">
                        {post.fbContent || (post.body ? `${post.hook}\n\n${post.body}\n\n${post.cta}` : "Belum di-generate untuk Facebook.")}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
