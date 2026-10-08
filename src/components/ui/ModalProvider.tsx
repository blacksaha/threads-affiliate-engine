"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle, Sparkles } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

interface PromptOptions {
  title?: string;
  message: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  defaultValue?: string;
}

interface ModalContextType {
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useUI = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useUI must be used within a ModalProvider");
  }
  return context;
};

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<(ConfirmOptions & { resolve: (val: boolean) => void }) | null>(null);
  const [promptModal, setPromptModal] = useState<(PromptOptions & { resolve: (val: string | null) => void }) | null>(null);
  const [promptValue, setPromptValue] = useState("");

  const addToast = useCallback((type: ToastType, message: string, title?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message, title }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const toast = {
    success: (message: string, title?: string) => addToast("success", message, title),
    error: (message: string, title?: string) => addToast("error", message, title),
    info: (message: string, title?: string) => addToast("info", message, title),
  };

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmModal({ ...options, resolve });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setPromptValue(options.defaultValue || "");
      setPromptModal({ ...options, resolve });
    });
  }, []);

  const handleConfirmClose = (result: boolean) => {
    if (confirmModal) {
      confirmModal.resolve(result);
      setConfirmModal(null);
    }
  };

  const handlePromptClose = (submit: boolean) => {
    if (promptModal) {
      promptModal.resolve(submit ? promptValue : null);
      setPromptModal(null);
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmModal) handleConfirmClose(false);
        if (promptModal) handlePromptClose(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmModal, promptModal]);

  return (
    <ModalContext.Provider value={{ toast, confirm, prompt }}>
      {children}

      {/* TOASTS CONTAINER */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-3 pointer-events-none w-full max-w-sm px-4 md:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white animate-in slide-in-from-top-4 fade-in duration-200`}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === "success" && <CheckCircle2 className="w-6 h-6 text-green-500 fill-green-100" />}
              {t.type === "error" && <AlertCircle className="w-6 h-6 text-red-500 fill-red-100" />}
              {t.type === "info" && <Info className="w-6 h-6 text-blue-500 fill-blue-100" />}
            </div>
            <div className="flex-1 min-w-0">
              {t.title && <h4 className="font-black text-[15px] text-black mb-0.5 uppercase tracking-wide">{t.title}</h4>}
              <p className="text-[13px] font-bold text-gray-700 leading-snug">{t.message}</p>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="shrink-0 text-gray-400 hover:text-black transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

      {/* CONFIRM MODAL OVERLAY */}
      {confirmModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="cartoon-card bg-white max-w-sm w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${confirmModal.isDestructive ? 'bg-red-300' : 'bg-[#ffb347]'}`}>
                {confirmModal.isDestructive ? <AlertTriangle className="w-6 h-6 text-black" /> : <Sparkles className="w-6 h-6 text-black" />}
              </div>
              <h3 className="text-xl font-black text-black uppercase tracking-tight leading-tight">
                {confirmModal.title || "Konfirmasi"}
              </h3>
            </div>
            <p className="text-[14px] font-bold text-gray-700 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleConfirmClose(false)}
                className="flex-1 py-3 px-4 bg-white border-[3px] border-black text-black font-black text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all uppercase"
              >
                {confirmModal.cancelText || "Batal"}
              </button>
              <button
                onClick={() => handleConfirmClose(true)}
                className={`flex-1 py-3 px-4 border-[3px] border-black text-black font-black text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all uppercase ${
                  confirmModal.isDestructive ? "bg-red-400" : "bg-[#ffb347]"
                }`}
              >
                {confirmModal.confirmText || "Ya, Lanjut!"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROMPT MODAL OVERLAY */}
      {promptModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="cartoon-card bg-white max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-black uppercase tracking-tight">
              {promptModal.title || "Input Form"}
            </h3>
            <p className="text-[14px] font-bold text-gray-700 leading-relaxed">
              {promptModal.message}
            </p>
            <input
              type="text"
              autoFocus
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder={promptModal.placeholder}
              className="w-full bg-white border-[3px] border-black px-4 py-3 text-[14px] font-bold text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-0 mb-2"
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePromptClose(true);
              }}
            />
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handlePromptClose(false)}
                className="flex-1 py-3 px-4 bg-white border-[3px] border-black text-black font-black text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all uppercase"
              >
                {promptModal.cancelText || "Batal"}
              </button>
              <button
                onClick={() => handlePromptClose(true)}
                className="flex-1 py-3 px-4 border-[3px] border-black bg-[#ffb347] text-black font-black text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all uppercase"
              >
                {promptModal.confirmText || "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};