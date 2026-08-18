import React, { useState, useEffect, useCallback, useRef } from "react";
import { Plus, RefreshCw, Trash2, Flame, TrendingUp, TrendingDown, ExternalLink, X, ChevronUp, ChevronDown } from "lucide-react";

// ---------- palette (inline styles — this renderer doesn't compile arbitrary Tailwind values) ----------
const C = {
  bg: "#0B0C0E",
  panel: "#141519",
  rowHover: "#131418",
  border: "#232428",
  borderSubtle: "#1A1B1F",
  inputBg: "#0B0C0E",
  inputBorder: "#2A2B30",
  text: "#E8E6E1",
  textBright: "#F4F2ED",
  textMuted: "#9A9891",
  textDim: "#6B6E76",
  textFaint: "#4A4B50",
  accent: "#3D9DFF",
  accentHover: "#5CB3FF",
  accentSoft: "#7FC4FF",
  diamond: "#8ECBFF",
  green: "#5FBF7A",
  red: "#E8756B",
  bannerBg: "#0A1420",
  bannerBorder: "#1B3A5C",
  bannerText: "#5CB3FF",
};

// ---------- helpers ----------

const fmtUsd = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(3)}`;
};

const fmtPrice = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (n >= 1) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(4)}`;
};

const shortAddr = (a) => (a && a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

const STORAGE_KEY = "z500-tracked-projects";

// $ANSEM (The Black Bull) — corroborated across multiple independent sources (DexScreener,
// GeckoTerminal, Phantom, OKX, CoinMarketCap) as of Aug 2026. Verify independently before
// trusting this for anything involving real funds — copycat tokens exist.
const ANSEM_MINT = "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump";
const ANSEM_DECIMALS = 6;
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const BURN_SCAN_LIMIT = 40; // signatures checked per wallet — recent-window only, see UI note

async function rpcCall(method, params) {
  const res = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Scans a wallet's recent transaction history for SPL Token burn instructions on the $ANSEM
// mint and sums them. Only covers the last BURN_SCAN_LIMIT transactions from that wallet —
// older burns outside that window won't be counted.
async function fetchOnchainBurns(walletAddress) {
  const sigs = await rpcCall("getSignaturesForAddress", [walletAddress, { limit: BURN_SCAN_LIMIT }]);
  if (!sigs || sigs.length === 0) return { verifiedBurn: 0, txChecked: 0, txBurned: 0 };

  let total = 0;
  let burnTxCount = 0;
  for (const sig of sigs) {
    try {
      const tx = await rpcCall("getTransaction", [
        sig.signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ]);
      const allInstructions = [
        ...(tx?.transaction?.message?.instructions || []),
        ...(tx?.meta?.innerInstructions || []).flatMap((i) => i.instructions),
      ];
      let foundInTx = false;
      for (const ix of allInstructions) {
        const parsed = ix?.parsed;
        if (!parsed) continue;
        if ((parsed.type === "burn" || parsed.type === "burnChecked") && parsed.info?.mint === ANSEM_MINT) {
          const rawAmount = parsed.info.tokenAmount?.uiAmount ?? Number(parsed.info.amount) / 10 ** ANSEM_DECIMALS;
          total += rawAmount || 0;
          foundInTx = true;
        }
      }
      if (foundInTx) burnTxCount += 1;
    } catch (e) {
      // skip individual tx failures, keep scanning
    }
    await sleep(120); // stay under public RPC rate limits
  }
  return { verifiedBurn: total, txChecked: sigs.length, txBurned: burnTxCount };
}

async function fetchDexData(mint) {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
  if (!res.ok) throw new Error(`DexScreener ${res.status}`);
  const json = await res.json();
  const pairs = json?.pairs || [];
  if (pairs.length === 0) return null;
  const best = pairs.reduce((a, b) => ((b.liquidity?.usd || 0) > (a.liquidity?.usd || 0) ? b : a));
  return {
    priceUsd: best.priceUsd ? parseFloat(best.priceUsd) : null,
    marketCap: best.fdv ?? best.marketCap ?? null,
    volume24h: best.volume?.h24 ?? null,
    change24h: best.priceChange?.h24 ?? null,
    liquidity: best.liquidity?.usd ?? null,
    dexUrl: best.url || null,
    symbol: best.baseToken?.symbol || "",
    name: best.baseToken?.name || "",
  };
}

// score proxy: mcap of the airdropped supply (approximated by full token mcap) + burn weight.
// Uses the onchain-verified burn figure when available, falls back to self-reported.
function effectiveBurn(p) {
  return p.verifiedBurn !== undefined && p.verifiedBurn !== null ? p.verifiedBurn : p.burnAmount || 0;
}

function computeScore(p) {
  const mcap = p.live?.marketCap || 0;
  const burnUsd = effectiveBurn(p) * (p.burnPriceRef || 0);
  return mcap * 0.6 + burnUsd * 40;
}

const TIERS = ["Unranked", "Standard", "Gold", "Diamond"];

const tierColor = (t) => (t === "Diamond" ? C.diamond : t === "Gold" ? C.accentSoft : C.textMuted);

// ---------- main component ----------

export default function Z500Tracker() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState("score");
  const [sortDir, setSortDir] = useState("desc");
  const [form, setForm] = useState({ name: "", mint: "", tier: "Standard", burnAmount: "", launchWallet: "" });
  const [ansemPrice, setAnsemPrice] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);
  const prevRanks = useRef({});

  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY, false);
        if (result?.value) setProjects(JSON.parse(result.value));
      } catch (e) {
        /* no saved data yet */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (next) => {
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(next), false);
    } catch (e) {
      console.error("storage save failed", e);
    }
  }, []);

  const refreshAll = useCallback(
    async (list) => {
      setRefreshing(true);
      setError(null);
      try {
        const updated = await Promise.all(
          list.map(async (p) => {
            try {
              const live = await fetchDexData(p.mint);
              return { ...p, live, lastUpdated: Date.now(), fetchError: live ? null : "No pairs found" };
            } catch (e) {
              return { ...p, fetchError: "Fetch failed" };
            }
          })
        );

        const ranked = [...updated].sort((a, b) => computeScore(b) - computeScore(a));
        const newRanks = {};
        ranked.forEach((p, i) => (newRanks[p.id] = i));
        const withDeltas = updated.map((p) => ({
          ...p,
          rankDelta: prevRanks.current[p.id] !== undefined ? prevRanks.current[p.id] - newRanks[p.id] : 0,
        }));
        prevRanks.current = newRanks;

        setProjects(withDeltas);
        persist(withDeltas);

        try {
          const cg = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=the-black-bull&vs_currencies=usd");
          if (cg.ok) {
            const cgJson = await cg.json();
            const p = cgJson?.["the-black-bull"]?.usd;
            if (p) setAnsemPrice(p);
          }
        } catch (e) {
          /* non-critical */
        }
      } catch (e) {
        setError("Couldn't refresh live data. Check your connection and try again.");
      } finally {
        setRefreshing(false);
      }
    },
    [persist]
  );

  useEffect(() => {
    if (!loading && projects.length > 0) refreshAll(projects);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const verifyBurn = async (id) => {
    const project = projects.find((p) => p.id === id);
    if (!project?.launchWallet) return;
    setVerifyingId(id);
    try {
      const result = await fetchOnchainBurns(project.launchWallet.trim());
      const next = projects.map((p) =>
        p.id === id
          ? {
              ...p,
              verifiedBurn: result.verifiedBurn,
              verifiedTxChecked: result.txChecked,
              verifiedAt: Date.now(),
              verifyError: null,
            }
          : p
      );
      setProjects(next);
      persist(next);
    } catch (e) {
      const next = projects.map((p) =>
        p.id === id ? { ...p, verifyError: "Couldn't reach Solana RPC — try again" } : p
      );
      setProjects(next);
    } finally {
      setVerifyingId(null);
    }
  };

  const addProject = async () => {
    if (!form.name.trim() || !form.mint.trim()) return;
    const newProject = {
      id: `${Date.now()}`,
      name: form.name.trim(),
      mint: form.mint.trim(),
      tier: form.tier,
      burnAmount: parseFloat(form.burnAmount) || 0,
      burnPriceRef: ansemPrice || 0,
      launchWallet: form.launchWallet.trim() || null,
      verifiedBurn: null,
      addedAt: Date.now(),
      live: null,
      rankDelta: 0,
    };
    const next = [...projects, newProject];
    setProjects(next);
    persist(next);
    setForm({ name: "", mint: "", tier: "Standard", burnAmount: "", launchWallet: "" });
    setShowAdd(false);
    refreshAll(next);
  };

  const removeProject = (id) => {
    const next = projects.filter((p) => p.id !== id);
    setProjects(next);
    persist(next);
  };

  const updateBurn = (id, value) => {
    const next = projects.map((p) =>
      p.id === id ? { ...p, burnAmount: parseFloat(value) || 0, burnPriceRef: ansemPrice || p.burnPriceRef } : p
    );
    setProjects(next);
    persist(next);
  };

  const updateTier = (id, value) => {
    const next = projects.map((p) => (p.id === id ? { ...p, tier: value } : p));
    setProjects(next);
    persist(next);
  };

  const sorted = [...projects].sort((a, b) => {
    let av, bv;
    switch (sortKey) {
      case "score":
        av = computeScore(a);
        bv = computeScore(b);
        break;
      case "mcap":
        av = a.live?.marketCap || 0;
        bv = b.live?.marketCap || 0;
        break;
      case "change":
        av = a.live?.change24h || 0;
        bv = b.live?.change24h || 0;
        break;
      case "burn":
        av = a.burnAmount || 0;
        bv = b.burnAmount || 0;
        break;
      default:
        av = 0;
        bv = 0;
    }
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const th = (key, label, align = "right") => (
    <th
      onClick={() => toggleSort(key)}
      className="px-4 py-3 font-medium cursor-pointer"
      style={{ textAlign: align, fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}
    >
      {label} {sortKey === key && (sortDir === "desc" ? "↓" : "↑")}
    </th>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg, color: C.text, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
        .z-mono { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
        .z-display { font-family: 'Bebas Neue', sans-serif; }
        input:focus, select:focus { outline: none; border-color: ${C.accent} !important; }
        ::placeholder { color: ${C.textFaint}; }
      `}</style>

      {/* unofficial banner */}
      <div style={{ backgroundColor: C.bannerBg, borderBottom: `1px solid ${C.bannerBorder}`, padding: "8px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 11, color: C.bannerText, letterSpacing: "0.02em", margin: 0 }}>
          Unofficial community tracker · not built or endorsed by ansem.io
        </p>
      </div>

      {/* header */}
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: "18px 20px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.accent}66`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Flame size={16} color={C.accent} strokeWidth={2} />
            </div>
            <div>
              <h1 className="z-display" style={{ fontSize: 30, lineHeight: 1, color: C.textBright, letterSpacing: "0.02em", margin: 0 }}>
                Z500 TRACKER
              </h1>
              <p style={{ fontSize: 11, color: C.textDim, marginTop: 4, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Every tracked launch, cross-checked
              </p>
            </div>
          </div>
          <button
            onClick={() => refreshAll(projects)}
            disabled={refreshing || projects.length === 0}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8,
              backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 14,
              cursor: refreshing || projects.length === 0 ? "not-allowed" : "pointer",
              opacity: refreshing || projects.length === 0 ? 0.4 : 1,
            }}
          >
            <RefreshCw size={14} style={refreshing ? { animation: "spin 1s linear infinite" } : {}} />
            <span>{refreshing ? "Refreshing" : "Refresh"}</span>
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
        {/* explainer */}
        <div style={{ marginBottom: 24, borderRadius: 10, border: `1px solid ${C.border}`, backgroundColor: C.panel, padding: "14px 16px", fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
          Score ranks tracked launches by market cap of the airdropped supply plus $ANSEM burn value — the same two
          inputs z500 uses. Add a project's launch wallet to pull real burn transactions from Solana directly (last{" "}
          {BURN_SCAN_LIMIT} tx scanned) — otherwise burn stays self-reported. Live price / mcap / volume come
          straight from DexScreener.
          {ansemPrice && (
            <span style={{ marginLeft: 6, color: C.textDim }}>
              $ANSEM ref price: <span className="z-mono" style={{ color: C.textMuted }}>${ansemPrice}</span>
            </span>
          )}
        </div>

        {error && (
          <div style={{ marginBottom: 16, borderRadius: 8, border: `1px solid ${C.bannerBorder}`, backgroundColor: C.bannerBg, padding: "10px 16px", fontSize: 14, color: C.accentSoft }}>
            {error}
          </div>
        )}

        {/* add button */}
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => setShowAdd((s) => !s)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 8, backgroundColor: C.accent, color: C.bg, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            {showAdd ? <X size={15} /> : <Plus size={15} />}
            {showAdd ? "Cancel" : "Track a launch"}
          </button>
        </div>

        {/* add form */}
        {showAdd && (
          <div style={{ marginBottom: 24, borderRadius: 10, border: `1px solid ${C.border}`, backgroundColor: C.panel, padding: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: C.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Project name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Bull's Eye"
                  style={{ width: "100%", backgroundColor: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 8, padding: "8px 12px", fontSize: 14, color: C.text }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: C.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Solana mint address
                </label>
                <input
                  value={form.mint}
                  onChange={(e) => setForm({ ...form, mint: e.target.value })}
                  placeholder="CA4ocJdJsAzBdxzhP4KUJLdjevvjugsbLzXe3wc8pump"
                  className="z-mono"
                  style={{ width: "100%", backgroundColor: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: C.text }}
                />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: C.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Tier
                </label>
                <select
                  value={form.tier}
                  onChange={(e) => setForm({ ...form, tier: e.target.value })}
                  style={{ width: "100%", backgroundColor: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 8, padding: "8px 12px", fontSize: 14, color: C.text }}
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: C.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  $ANSEM burned (self-reported)
                </label>
                <input
                  type="number"
                  value={form.burnAmount}
                  onChange={(e) => setForm({ ...form, burnAmount: e.target.value })}
                  placeholder="0"
                  className="z-mono"
                  style={{ width: "100%", backgroundColor: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 8, padding: "8px 12px", fontSize: 14, color: C.text }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, color: C.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Launch wallet (optional — enables onchain burn verification)
              </label>
              <input
                value={form.launchWallet}
                onChange={(e) => setForm({ ...form, launchWallet: e.target.value })}
                placeholder="The wallet that bought + burned $ANSEM for this launch"
                className="z-mono"
                style={{ width: "100%", backgroundColor: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: C.text }}
              />
              <p style={{ fontSize: 11, color: C.textFaint, marginTop: 4 }}>
                Scans the last {BURN_SCAN_LIMIT} transactions from this wallet for $ANSEM burn instructions. Leave
                blank to track with self-reported numbers only.
              </p>
            </div>
            <button
              onClick={addProject}
              disabled={!form.name.trim() || !form.mint.trim()}
              style={{
                padding: "10px 16px", borderRadius: 8, backgroundColor: C.accent, color: C.bg, fontSize: 14, fontWeight: 600, border: "none",
                cursor: !form.name.trim() || !form.mint.trim() ? "not-allowed" : "pointer",
                opacity: !form.name.trim() || !form.mint.trim() ? 0.4 : 1,
              }}
            >
              Add to tracker
            </button>
          </div>
        )}

        {/* table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "64px 0", color: C.textDim, fontSize: 14 }}>Loading tracker…</div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 0", borderRadius: 10, border: `1px dashed ${C.border}` }}>
            <p style={{ color: C.textMuted, fontSize: 14, marginBottom: 4 }}>Nothing tracked yet.</p>
            <p style={{ color: C.textDim, fontSize: 13 }}>Add a launch's mint address to start pulling live data.</p>
          </div>
        ) : (
          <div style={{ borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                    <th className="px-4 py-3" style={{ textAlign: "left", fontSize: 11, color: C.textDim, textTransform: "uppercase" }}>#</th>
                    <th className="px-4 py-3" style={{ textAlign: "left", fontSize: 11, color: C.textDim, textTransform: "uppercase" }}>Project</th>
                    <th className="px-4 py-3" style={{ textAlign: "left", fontSize: 11, color: C.textDim, textTransform: "uppercase" }}>Tier</th>
                    <th className="px-4 py-3" style={{ textAlign: "right", fontSize: 11, color: C.textDim, textTransform: "uppercase" }}>Price</th>
                    {th("mcap", "Mkt cap")}
                    {th("change", "24h")}
                    {th("burn", "Burned")}
                    {th("score", "Score")}
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
                      <td className="px-4 py-3 z-mono" style={{ color: C.textDim }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {i + 1}
                          {p.rankDelta > 0 && (
                            <span style={{ display: "flex", alignItems: "center", color: C.green, fontSize: 10 }}>
                              <ChevronUp size={12} />
                              {p.rankDelta}
                            </span>
                          )}
                          {p.rankDelta < 0 && (
                            <span style={{ display: "flex", alignItems: "center", color: C.red, fontSize: 10 }}>
                              <ChevronDown size={12} />
                              {Math.abs(p.rankDelta)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div style={{ color: C.textBright, fontWeight: 500 }}>{p.name}</div>
                        <div className="z-mono" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.textDim }}>
                          {shortAddr(p.mint)}
                          {p.live?.dexUrl && (
                            <a href={p.live.dexUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.textDim }}>
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                        {p.fetchError && <div style={{ fontSize: 10, color: C.red, marginTop: 2 }}>{p.fetchError}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={p.tier}
                          onChange={(e) => updateTier(p.id, e.target.value)}
                          style={{ fontSize: 11, borderRadius: 6, padding: "4px 6px", backgroundColor: C.inputBg, border: `1px solid ${C.inputBorder}`, color: tierColor(p.tier) }}
                        >
                          {TIERS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 z-mono" style={{ textAlign: "right", color: C.text }}>
                        {fmtPrice(p.live?.priceUsd)}
                      </td>
                      <td className="px-4 py-3 z-mono" style={{ textAlign: "right", color: C.text }}>
                        {fmtUsd(p.live?.marketCap)}
                      </td>
                      <td className="px-4 py-3 z-mono" style={{ textAlign: "right" }}>
                        {p.live?.change24h !== null && p.live?.change24h !== undefined ? (
                          <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, color: p.live.change24h >= 0 ? C.green : C.red }}>
                            {p.live.change24h >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {Math.abs(p.live.change24h).toFixed(1)}%
                          </span>
                        ) : (
                          <span style={{ color: C.textFaint }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3" style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                          {p.verifiedBurn !== null && p.verifiedBurn !== undefined ? (
                            <>
                              <span className="z-mono" style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>
                                {p.verifiedBurn.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </span>
                              <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: C.green, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                ✓ onchain · last {p.verifiedTxChecked} tx
                              </span>
                            </>
                          ) : (
                            <>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                                <input
                                  type="number"
                                  value={p.burnAmount || ""}
                                  onChange={(e) => updateBurn(p.id, e.target.value)}
                                  placeholder="0"
                                  className="z-mono"
                                  style={{ width: 80, backgroundColor: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 6, padding: "4px 8px", textAlign: "right", fontSize: 12, color: C.accentSoft }}
                                />
                                <Flame size={11} color={C.accent} style={{ flexShrink: 0 }} />
                              </div>
                              <span style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                {p.burnAmount ? "self-reported" : "no burn logged"}
                              </span>
                            </>
                          )}
                          {p.launchWallet && (
                            <button
                              onClick={() => verifyBurn(p.id)}
                              disabled={verifyingId === p.id}
                              style={{
                                background: "none", border: "none", color: C.accentSoft, fontSize: 9,
                                textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer", padding: 0, marginTop: 1,
                                opacity: verifyingId === p.id ? 0.5 : 1,
                              }}
                            >
                              {verifyingId === p.id ? "Scanning…" : p.verifiedBurn != null ? "Re-verify" : "Verify onchain"}
                            </button>
                          )}
                          {p.verifyError && (
                            <span style={{ fontSize: 9, color: C.red }}>{p.verifyError}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 z-mono" style={{ textAlign: "right", color: C.accentHover, fontWeight: 600 }}>
                        {fmtUsd(computeScore(p))}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => removeProject(p.id)} style={{ background: "none", border: "none", color: C.textFaint, cursor: "pointer" }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p style={{ marginTop: 24, fontSize: 11, color: C.textFaint, lineHeight: 1.6 }}>
          Data from DexScreener (price/mcap/volume, public API), CoinGecko ($ANSEM reference price), and Solana's
          public RPC (onchain burn verification, when a launch wallet is provided — scans only the last{" "}
          {BURN_SCAN_LIMIT} transactions from that wallet, so older burns outside that window won't be counted).
          $ANSEM mint address is corroborated across multiple sources but not independently audited by this tool —
          verify it yourself before relying on any figure here. Treat "Score" as a directional proxy for the official
          z500 leaderboard, not the leaderboard itself. Not financial advice.
        </p>
      </main>
    </div>
  );
}
