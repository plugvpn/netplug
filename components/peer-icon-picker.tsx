"use client";

import { useEffect, useRef, useState } from "react";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  PEER_ICON_IDS,
  displayPeerIconId,
  lucideExportNameForPeerIcon,
  peerIconGridLabel,
  type PeerIconId,
} from "@/lib/peer-icons";

function getLucideIcon(id: string): LucideIcon {
  const map = Icons as unknown as Record<string, LucideIcon | undefined>;
  const exportName = lucideExportNameForPeerIcon(id);
  const Icon = map[exportName];
  return Icon ?? Icons.User;
}

export function PeerIconGlyph({
  iconId,
  className,
  strokeWidth = 1.5,
}: {
  iconId: string | null | undefined;
  className?: string;
  strokeWidth?: number;
}) {
  const id = displayPeerIconId(iconId);
  const Icon = getLucideIcon(id);
  return <Icon className={className} strokeWidth={strokeWidth} />;
}

export function PeerIconPicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null | undefined;
  onChange: (iconId: PeerIconId) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const currentId = displayPeerIconId(value);
  const CurrentIcon = getLucideIcon(currentId);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        title="Choose peer icon"
        aria-label="Choose peer icon"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-colors hover:border-emerald-500 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/40"
      >
        <CurrentIcon className="h-5 w-5" strokeWidth={1.5} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Select peer icon"
            className="max-h-[min(24rem,85vh)] w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-600 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Choose peer icon
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Shown in the user list next to the username
              </p>
            </div>
            <div className="max-h-[min(16rem,50vh)] overflow-y-auto p-3">
              <div className="grid grid-cols-6 gap-1.5">
                {PEER_ICON_IDS.map((id) => {
                  const Icon = getLucideIcon(id);
                  const selected = id === currentId;
                  const label = peerIconGridLabel(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      title={label}
                      onClick={() => {
                        onChange(id);
                        setOpen(false);
                      }}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
                        selected
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-400"
                          : "border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-800"
                      }`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
