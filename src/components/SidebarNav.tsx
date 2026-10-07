"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Home, ListTodo, Package, Calendar, Settings, Activity, Menu, X, Users } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";

export default function SidebarNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  const role = (session?.user as any)?.role || "USER";

  const links = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/products", label: "Database Produk", icon: Package },
    { href: "/queue", label: "Content Queue", icon: ListTodo },
    { href: "/calendar", label: "Kalender", icon: Calendar },
    { href: "/analytics", label: "Analytics & AI Loop", icon: Activity },
    { href: "/logs", label: "Activity Logs", icon: Activity },
    { href: "/settings", label: "Automation Settings", icon: Settings },
  ];

  if (role === "ADMIN") {
    links.push({ href: "/admin", label: "Admin Console", icon: Users });
  }

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Mobile Header Toggle */}
      <div className="md:hidden flex flex-row items-center justify-between p-4 bg-white cartoon-border border-b-4 z-50 relative w-full sticky top-0">
        <h1 className="font-black text-lg text-black tracking-tighter">THREADS<span className="text-main">.AFF</span></h1>
        <button onClick={toggleMenu} className="cartoon-btn bg-white p-1.5 flex items-center justify-center">
          {isOpen ? <X className="w-6 h-6 stroke-[3]" /> : <Menu className="w-6 h-6 stroke-[3]" />}
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm" 
          onClick={toggleMenu}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-bg cartoon-border md:border-t-0 md:border-b-0 md:border-l-0 border-r-4 
        flex flex-col justify-between shrink-0 h-full overflow-y-auto
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="p-5">
          <div className="hidden md:block mb-8 cartoon-card bg-main p-3 transform -rotate-1">
            <h1 className="font-black text-xl text-black tracking-tight leading-tight text-center">
              THREADS<br/>ENGINE
            </h1>
            <p className="text-[10px] text-center font-extrabold mt-1 uppercase tracking-widest text-gray-800">
              ⚡ Autonomous
            </p>
          </div>

          <nav className="space-y-2">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl font-black text-xs transition-all
                    ${isActive 
                      ? "cartoon-border shadow-neo bg-main translate-x-1 text-black" 
                      : "text-slate-700 hover:text-black hover:bg-white border-3 border-transparent hover:cartoon-border hover:shadow-neo hover:translate-x-1"}
                  `}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-black" : "text-slate-600"}`} strokeWidth={isActive ? 3 : 2.5} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {session && (
          <div className="p-5 border-t-[3px] border-[#111111] bg-white">
            <div className="flex items-center justify-between mb-3">
              <div className="truncate pr-2">
                <p className="text-xs font-black text-black truncate">{session.user?.name || "User"}</p>
                <p className="text-[10px] font-bold text-slate-600 truncate">{session.user?.email}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full cartoon-btn flex items-center justify-center gap-2 px-3 py-2 text-xs font-black text-black bg-accent hover:bg-red-500"
            >
              <LogOut className="w-3.5 h-3.5 stroke-[3]" />
              Keluar
            </button>
          </div>
        )}
      </div>
    </>
  );
}
