export const ANSEM_MINT = "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump";
export const ANSEM_DECIMALS = 6;

export function isIndexMint(mint: string | null | undefined) {
  return mint === ANSEM_MINT;
}
export const BURN_PAGE_SIZE = 40;
export const BURN_MAX_PAGES = 12;
export const BURN_MAX_PAGES_PAID = 80;
export const REPORT_HIDE_THRESHOLD = 3;
export const ADD_RATE_LIMIT = 5;
export const ADD_RATE_WINDOW_MS = 60 * 60 * 1000;
export const BOOST_WEIGHT = 250;
export const AIRDROP_WEIGHT = 0.6;
export const BURN_USD_WEIGHT = 40;
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

export type TapeKind = "burn" | "launch" | "migrate" | "boost" | "flag" | "rank";

export type TapeEvent = {
  id: string;
  kind: TapeKind;
  at: number;
  mint: string;
  name: string;
  ticker?: string;
  slug?: string;
  wallet?: string;
  amount?: number;
  label: string;
};

export const ISSUED_FLAG_TYPES = ["serial"] as const;
export type IssuedFlagType = (typeof ISSUED_FLAG_TYPES)[number];

export const FLAG_OUTCOMES = ["confirmed_rug", "held", "burned_as_claimed"] as const;
export type FlagOutcome = (typeof FLAG_OUTCOMES)[number];

/** Durable flag row. Survives the 80-row tape. Outcome stays null until a later resolver. */
export type FlagIssued = {
  id: string;
  wallet: string;
  mint: string;
  name: string;
  ticker?: string;
  slug?: string;
  flagType: IssuedFlagType;
  threshold: number;
  launchCount: number;
  issuedAt: number;
  resolutionDueAt: number;
  outcome: FlagOutcome | null;
  outcomeResolvedAt: number | null;
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
  sameBlockBuyers?: string[];
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

export type BurnVia = "wallet" | "mint" | "memo" | "amount";

export type AttributedBurn = {
  signature: string;
  mint: string;
  amount: number;
  via: BurnVia;
  wallet: string;
  at: number;
};

export type LedgerHit = {
  signature: string;
  wallet: string;
  amount: number;
  at: number;
  mint?: string;
  /** False when we still cannot tell which coin this $ANSEM burn was for. */
  labeled?: boolean;
  via?: BurnVia;
  /** Exact amount matches more than one credited gap. Not assigned. */
  candidates?: string[];
};

export type MintBurnIndex = {
  cursor: string | null;
  headSig: string | null;
  exhausted: boolean;
  scannedAt: number;
  txChecked: number;
  txBurned: number;
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
  txns24h?: number | null;
  listedVolume24h?: number | null;
  listedChange24h?: number | null;
  nsfw?: boolean;
  burnAmount: number;
  burnPriceRef: number;
  verifiedBurn: number | null;
  /** Launch-wallet scan only. verifiedBurn also includes attributed stranger burns. */
  walletBurned?: number | null;
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
  /** Crosscheck rank vs yesterday's daily index (positive = climbed). */
  dayDelta?: number;
  holderTop10Pct?: number | null;
  insiderPct?: number | null;
  sniper?: boolean;
  walletProvenance?: ProvenanceStatus;
  boostPoints: number;
  boostGolden: boolean;
  boostExpiresAt: string | null;
  listedAirdropMcap: number | null;
  listedMarketCap: number | null;
  listedBurn?: number | null;
  listedBurners?: number | null;
  officialRank: number | null;
  officialDelta: number | null;
  score: number;
  flags: Flag[];
  launchCount: number;
};

export type BoardStats = {
  coins: number;
  launched: number | null;
  airdroppedTokens: number | null;
  airdroppedUsd: number | null;
  airdroppedUsdNow: number | null;
  airdroppedCoins: number | null;
  airdroppedWallets: number | null;
  airdroppedPricedShare: number | null;
  burnedAnsem: number | null;
  verifiedBurned: number;
  listedBurned: number;
  burnVerifiedPct: number | null;
  ansemCoinsCredited: number;
  ansemCoinsMatched: number;
  unlabeledBurned: number;
  unlabeledHits: number;
  mintExhausted: boolean;
  mintTxChecked: number;
  holders: number | null;
  boosted: number;
  flagged: number;
  scannedWallets: number;
  exhaustedWallets: number;
  paidPending: number;
  paidWallets: number;
  paidIndexed: number;
  paidExhausted: number;
  lastScanAt: number | null;
  lastBurnAt: number | null;
  webhookAt: number | null;
  coverageLive: boolean;
  listedAt: number | null;
};

export const EMPTY_BOARD_STATS: BoardStats = {
  coins: 0,
  launched: null,
  airdroppedTokens: null,
  airdroppedUsd: null,
  airdroppedUsdNow: null,
  airdroppedCoins: null,
  airdroppedWallets: null,
  airdroppedPricedShare: null,
  burnedAnsem: null,
  verifiedBurned: 0,
  listedBurned: 0,
  burnVerifiedPct: null,
  ansemCoinsCredited: 0,
  ansemCoinsMatched: 0,
  unlabeledBurned: 0,
  unlabeledHits: 0,
  mintExhausted: false,
  mintTxChecked: 0,
  holders: null,
  boosted: 0,
  flagged: 0,
  scannedWallets: 0,
  exhaustedWallets: 0,
  paidPending: 0,
  paidWallets: 0,
  paidIndexed: 0,
  paidExhausted: 0,
  lastScanAt: null,
  lastBurnAt: null,
  webhookAt: null,
  coverageLive: false,
  listedAt: null,
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
  burnLedger: LedgerHit[];
  burnHits: Record<string, LedgerHit>;
  mintBurnIndex: MintBurnIndex;
  attributedBurns: Record<string, AttributedBurn>;
  projectBurns: Record<string, { amount: number; burners: number }>;
  flagsIssued: FlagIssued[];
  webhookAt: number | null;
  scanLockUntil?: number;
};
