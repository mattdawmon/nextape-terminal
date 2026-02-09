import { useEffect, useCallback } from "react";

type HotkeyAction = () => void;

interface HotkeyConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: HotkeyAction;
  description: string;
}

function isInputFocused(): boolean {
  const tag = document.activeElement?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
    (document.activeElement as HTMLElement)?.isContentEditable === true;
}

export function useHotkeys(hotkeys: HotkeyConfig[], enabled = true) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;
    if (isInputFocused()) return;

    for (const hk of hotkeys) {
      const keyMatch = e.key.toLowerCase() === hk.key.toLowerCase();
      const ctrlMatch = hk.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
      const shiftMatch = hk.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = hk.alt ? e.altKey : !e.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        e.preventDefault();
        hk.action();
        return;
      }
    }
  }, [hotkeys, enabled]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

export const TRADING_HOTKEYS = [
  { key: "b", description: "Switch to Buy tab" },
  { key: "s", description: "Switch to Sell tab" },
  { key: "w", description: "Toggle watchlist" },
  { key: "1-6", description: "Quick amount buttons" },
  { key: "Enter", description: "Execute trade" },
  { key: "Escape", description: "Clear amount" },
  { key: "/", description: "Open search" },
  { key: "Ctrl+K", description: "Command palette" },
];
