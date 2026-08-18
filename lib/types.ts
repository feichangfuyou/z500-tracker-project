export const ANSEM_MINT = "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump";
export const ANSEM_DECIMALS = 6;
export const BURN_PAGE_SIZE = 40;
export const BURN_MAX_PAGES = 12;
export const BURN_MAX_PAGES_PAID = 80;
export const REPORT_HIDE_THRESHOLD = 3;
export const ADD_RATE_LIMIT = 5;
export const ADD_RATE_WINDOW_MS = 60 * 60 * 1000;
export const BOOST_WEIGHT = 250;
export const DEX_HOT_MS = 2 * 60 * 1000;
export const DEX_STALE_MS = 30 * 60 * 1000;
export const SCAN_STALE_MS = 10 * 60 * 1000;

export const TIERS = ["Free", "Bronze", "Gold", "Diamond", "Unranked"] as const;
export type Tier = (typeof TIERS)[number];

export type ProvenanceStatus = "matched" | "mismatch" | "unknown";

export type LiveData = {
  priceUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
  airdropMcap: number | null;
  volume24h: number | null;
  change24h: number | null;
  liquidity: number | null;
  dexUrl: string | null;
  symbol: string;
  name: string;
  mcapSource?: "dex" | "listed";
};

export type Boost = {
  amount: number;
  expiresAt: string;
  golden: boolean;
};

export type DexCache = {
  at: number;
  live: Omit<LiveData, "airdropMcap" | "mcapSource">;
};

export type ScanCursor = {
  at: number;
  scanned: number;
  lastWallet: string | null;
  errors: number;
};

export type RankSnapshot = {
  at: number;
  ranks: Record<string, number>;
  official?: Record<string, number>;
};

export type FlagSeverity = "warn" | "bad";
export type FlagId = "mismatch" | "top10" | "thinLiq" | "burnGap" | "unverified" | "clustered" | "sniper" | "serial";

export type Flag = {
  id: FlagId;
  label: string;
  severity: FlagSeverity;
};

export type TapeKind = "burn" | "launch" | "migrate" | "boost";

export type TapeEvent = {
  id: string;
  kind: TapeKind;
  at: number;
  mint: string;
  name: string;
  ticker?: string;
  slug?: string;
  amount?: number;
  label: string;
};

export type RankPoint = {
  at: number;
  rank: number;
  officialRank?: number | null;
};

export type BoostSeen = Record<string, { amount: number; expiresAt: string; expiring?: boolean }>;

export type HolderRow = {
  address: string;
  owner?: string | null;
  pct: number;
  insider: boolean;
};

export type HolderCache = {
  top10Pct: number;
  at: number;
  insiderPct?: number | null;
  sniper?: boolean;
  clustered?: boolean;
  holders?: HolderRow[];
};

export type Dossier = {
  at: number;
  holders: HolderRow[];
  creator: string | null;
  onchainCreator: string | null;
  pumpCreator: string | null;
  createSig: string | null;
  createSlot: number | null;
  sameBlockBuys: number;
  sameBlockWallets: number;
  sniper: boolean;
};

export type IndexCoin = {
  mint: string;
  name: string;
  ticker?: string;
  score: number;
  officialRank: number | null;
  airdropMcap: number | null;
  burned: number | null;
  imageUrl?: string | null;
  marketCap?: number | null;
  change24h?: number | null;
  tier?: string;
  status?: string | null;
  flags?: Flag[];
};

export type IndexDay = {
  at: number;
  coins: IndexCoin[];
};

export type MintStatus = Record<string, string | null>;

export type BurnCache = {
  wallet: string;
  verifiedBurn: number;
  txChecked: number;
  txBurned: number;
  scannedAt: number;
  cursor: string | null;
  exhausted: boolean;
  headSig: string | null;
  indexedBy?: "helius" | "rpc";
};

export type CommunityProject = {
  id: string;
  name: string;
  mint: string;
  tier: string;
  launchWallet: string | null;
  burnAmount: number;
  burnPriceRef: number;
  addedAt: number;
  addedBy: string;
  reports: number;
  hidden: boolean;
};

export type Project = {
  id: string;
  source: "ansem" | "community";
  slug?: string;
  name: string;
  ticker?: string;
  mint: string;
  tier: string;
  launchWallet: string | null;
  imageUrl?: string | null;
  bannerUrl?: string | null;
  enhancedAt?: string | null;
  status?: string | null;
  airdropTotal?: number | null;
  nsfw?: boolean;
  burnAmount: number;
  burnPriceRef: number;
  verifiedBurn: number | null;
  verifiedTxChecked: number | null;
  verifiedAt: number | null;
  verifyExhausted?: boolean;
  addedAt: number;
  addedBy: string | null;
  reports: number;
  hidden: boolean;
  live: LiveData | null;
  lastUpdated: number | null;
  fetchError?: string | null;
  rankDelta: number;
  holderTop10Pct?: number | null;
  insiderPct?: number | null;
  sniper?: boolean;
  walletProvenance?: ProvenanceStatus;
  boostPoints: number;
  boostGolden: boolean;
  boostExpiresAt: string | null;
  listedAirdropMcap: number | null;
  listedMarketCap: number | null;
  officialRank: number | null;
  officialDelta: number | null;
  score: number;
  flags: Flag[];
  launchCount: number;
};

export type BoardStats = {
  coins: number;
  airdroppedUsd: number | null;
  burnedAnsem: number | null;
  verifiedBurned: number;
  holders: number | null;
  boosted: number;
  flagged: number;
  scannedWallets: number;
  exhaustedWallets: number;
  paidPending: number;
  lastScanAt: number | null;
};

export const EMPTY_BOARD_STATS: BoardStats = {
  coins: 0,
  airdroppedUsd: null,
  burnedAnsem: null,
  verifiedBurned: 0,
  holders: null,
  boosted: 0,
  flagged: 0,
  scannedWallets: 0,
  exhaustedWallets: 0,
  paidPending: 0,
  lastScanAt: null,
};

export type BoardResponse = {
  projects: Project[];
  ansemPrice: number | null;
  solPrice: number | null;
  stats: BoardStats;
  lastSynced: number;
  sid: string;
  feedSource: "ansem" | "cache" | "pump" | "dex";
  tape: TapeEvent[];
  alerts: { telegram: boolean; discord: boolean };
};

export type Store = {
  rev?: number;
  community: CommunityProject[];
  burns: Record<string, BurnCache>;
  holders: Record<string, HolderCache>;
  boostSeen: BoostSeen;
  addLog: { sid: string; ip: string; at: number }[];
  reports: { mint: string; sid: string; at: number }[];
  provenance: Record<string, { creator: string | null; status: ProvenanceStatus; at: number }>;
  moderation: { id: string; mint: string; projectId: string; status: "open" | "hidden" | "dismissed"; createdAt: number }[];
  coinSnapshot: { at: number; coins: unknown[] };
  dex: Record<string, DexCache>;
  scanCursor: ScanCursor;
  rankSnapshot: RankSnapshot;
  tape: TapeEvent[];
  rankHistory: RankSnapshot[];
  seenMints: string[];
  mintStatus: MintStatus;
  watches: Record<string, string[]>;
  dossiers: Record<string, Dossier>;
  indexDays: IndexDay[];
  scanLockUntil?: number;
};
