"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    registerPWA?: () => Promise<void>;
  }
}

export function PWAProvider() {
  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", async () => {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
          });
          console.log("✅ Service Worker Registered:", registration.scope);
        } catch (error) {
          console.error("❌ Service Worker Registration Failed:", error);
        }
      });
    }
  }, []);

  return null;
}
