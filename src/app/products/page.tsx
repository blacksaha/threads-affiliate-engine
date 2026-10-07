import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProductCardActions from "@/components/ProductCardActions";
import { Package, Plus, ExternalLink } from "lucide-react";

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
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-black tracking-tight uppercase">Database Produk</h1>
          <p className="text-sm font-bold text-gray-700">
            Katalog produk affiliate yang terdaftar di engine.
          </p>
        </div>
        <Link
          href="/"
          className="cartoon-btn px-4 py-2.5 bg-main hover:bg-amber-400 text-black text-xs font-black flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          TAMBAH PRODUK
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="cartoon-card bg-white p-12 text-center space-y-4">
          <Package className="w-12 h-12 mx-auto stroke-[2.5] text-gray-400" />
          <p className="font-bold text-gray-700">Belum ada produk yang tersimpan di database.</p>
          <Link
            href="/"
            className="cartoon-btn inline-block px-4 py-2 bg-main text-black text-xs font-black"
          >
            Input Produk Pertama di Dashboard
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="cartoon-card bg-white p-5 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="cartoon-badge px-2 py-0.5 bg-gray-100 text-[10px] font-black">
                    {product.status}
                  </span>
                  <span className="cartoon-badge px-2 py-0.5 bg-emerald-200 text-[11px] font-black text-black">
                    Rp {product.price}
                  </span>
                </div>

                <h2 className="font-black text-black text-base line-clamp-2 leading-tight">
                  {product.name}
                </h2>

                <a
                  href={product.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline truncate max-w-full"
                >
                  <ExternalLink className="w-3 h-3 shrink-0 stroke-[3]" />
                  <span className="truncate">{product.affiliateUrl}</span>
                </a>

                {product.angles.length > 0 && (
                  <div className="pt-2">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
                      Content Angles:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {product.angles.map((a) => (
                        <span
                          key={a.id}
                          className="text-[9px] font-black bg-amber-100 text-black px-2 py-0.5 rounded border border-[#111111]"
                        >
                          {a.angleType}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 mt-4 border-t-2 border-gray-100 flex flex-col">
                <div className="flex items-center justify-between text-xs font-black text-gray-700">
                  <span>TOTAL UTAS:</span>
                  <span className="cartoon-badge px-2 py-0.5 bg-blue-100 text-[10px]">
                    {product.posts.length} Post
                  </span>
                </div>

                <ProductCardActions productId={product.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
