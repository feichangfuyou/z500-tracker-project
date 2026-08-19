export function fmtUsd(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (abs >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(3)}`;
}

export function fmtPrice(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (n >= 1) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(4)}`;
}

export function fmtNum(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function fmtCompact(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** ansem.io homepage compact (2.3B tokens, 29.4K wallets). */
export function fmtHead(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (abs >= 100) return `${Math.round(n)}`;
  return `${Number(n.toPrecision(3))}`;
}

/** z500 airdrop cell: ~425.0M tokens. */
export function fmtDrop(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n) || n <= 0) return "—";
  const abs = Math.abs(n);
  const body =
    abs >= 1_000_000_000
      ? `${(n / 1_000_000_000).toFixed(1)}B`
      : abs >= 1_000_000
        ? `${(n / 1_000_000).toFixed(1)}M`
        : abs >= 1_000
          ? `${(n / 1_000).toFixed(1)}K`
          : `${Math.round(n)}`;
  return `~${body}`;
}

/** z500 age cell: 47h 22m */
export function fmtAge(ts: number | null | undefined, now = Date.now()) {
  if (!ts) return "—";
  const n = Math.max(0, Math.floor((now - ts) / 60_000));
  if (n < 60) return `${n}m`;
  const h = Math.floor(n / 60);
  if (h < 48) return `${h}h ${n % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function indexStatusLabel(status?: string | null) {
  if (status === "migrated") return "Migrated";
  if (status === "on_curve") return "On curve";
  return launchStatusLabel(status) || "—";
}

export function fmtPct(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function fmtRank(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `#${Math.round(n)}`;
}

export function fmtInt(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString();
}

export function fmtHoldPct(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${Math.round(n)}%`;
}

export function shortAddr(a: string | null | undefined) {
  if (!a) return "";
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

export function launchStatusLabel(status?: string | null) {
  if (status === "on_curve") return "on curve";
  if (status === "migrated") return "migrated";
  return status ? status.replaceAll("_", " ") : null;
}

export function timeAgo(ts: number | null | undefined) {
  if (!ts) return "";
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
