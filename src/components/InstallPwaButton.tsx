"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

export default function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  if (!isInstallable) return null;

  return (
    <button
      onClick={handleInstallClick}
      className="cartoon-btn bg-amber-300 hover:bg-amber-400 text-black px-3 py-1.5 text-xs font-black flex items-center gap-1.5 transition-all animate-bounce"
      title="Install Aplikasi ke Layar Utama HP"
    >
      <Download className="w-3.5 h-3.5 stroke-[3]" />
      <span>INSTALL APP</span>
    </button>
  );
}
