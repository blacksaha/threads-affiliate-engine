import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const products = await prisma.product.findMany({
    where: { userId },
    include: {
      angles: true,
      posts: {
        select: {
          id: true,
          status: true,
          hook: true,
          qualityScore: true,
          scheduledAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Database Produk Affiliate</h1>
          <p className="text-sm text-slate-400">
            Katalog produk yang terdaftar dalam sistem otomasi konten.
          </p>
        </div>
        <Link
          href="/"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold rounded-lg text-white transition shadow-lg shadow-indigo-600/30"
        >
          + Tambah Produk Baru
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="bg-slate-950 p-12 rounded-2xl border border-slate-800 text-center space-y-4">
          <p className="text-slate-400">Belum ada produk yang tersimpan di database.</p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-lg text-slate-200"
          >
            Input Produk Pertama di Dashboard
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:border-slate-700 transition"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {product.status}
                  </span>
                  <span className="text-xs font-semibold text-emerald-400">
                    Rp {product.price}
                  </span>
                </div>

                <h2 className="font-bold text-slate-100 text-base line-clamp-2 leading-snug">
                  {product.name}
                </h2>

                <p className="text-xs text-slate-400 font-mono truncate">
                  🔗 {product.affiliateUrl}
                </p>

                {product.angles.length > 0 && (
                  <div className="pt-2 border-t border-slate-900">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Content Angles:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {product.angles.map((a) => (
                        <span
                          key={a.id}
                          className="text-[10px] font-medium bg-indigo-950/60 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800/40"
                        >
                          {a.angleType}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-900 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  Total Utas: <strong className="text-slate-200">{product.posts.length}</strong>
                </span>

                <form
                  action={async () => {
                    "use server";
                    const { runProductPipeline } = await import("@/lib/pipeline");
                    await runProductPipeline(product.id);
                    revalidatePath("/products");
                    revalidatePath("/queue");
                    revalidatePath("/");
                  }}
                >
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition cursor-pointer border border-slate-700/50"
                  >
                    ⚡ Auto-Generate Utas Baru
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
