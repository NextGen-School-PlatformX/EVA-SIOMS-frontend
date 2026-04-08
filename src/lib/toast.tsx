"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { Icon } from "@/components/ui/Icon";

// ── Types ──────────────────────────────────────
type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  msg: string;
  type: ToastType;
}

type AddToast = (msg: string, type?: ToastType) => void;

// ── Context ────────────────────────────────────
const ToastContext = createContext<AddToast | null>(null);

export const useToast = (): AddToast => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};

// ── Provider ───────────────────────────────────
let toastId = 0;

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast: AddToast = useCallback((msg, type = "info") => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <Icon
              name={t.type === "success" ? "check" : t.type === "error" ? "close" : "bell"}
              size={16}
            />
            <span style={{ fontSize: 14 }}>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
