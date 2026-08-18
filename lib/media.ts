const CID =
  /(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z2-7]{50,})/i;

const IPFS_HOST =
  /^(?:ipfs\.io|gateway\.pinata\.cloud|cloudflare-ipfs\.com|cf-ipfs\.com|w3s\.link|dweb\.link|nftstorage\.link)$/i;

function cidFrom(value: string) {
  const match = value.match(CID);
  return match ? match[0] : null;
}

export function publicImageUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("javascript:")) return null;

  if (trimmed.startsWith("ipfs://")) {
    const cid = cidFrom(trimmed.slice("ipfs://".length).replace(/^ipfs\//i, ""));
    return cid ? `https://ipfs.io/ipfs/${cid}` : null;
  }

  if (!trimmed.startsWith("https://")) {
    const cid = cidFrom(trimmed);
    return cid && trimmed === cid ? `https://ipfs.io/ipfs/${cid}` : null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();
  const subdomainCid = host.match(new RegExp(`^(${CID.source})\\.ipfs\\.`, "i"));
  const pathCid = url.pathname.startsWith("/ipfs/")
    ? cidFrom(url.pathname.slice("/ipfs/".length).split("/")[0] || "")
    : null;
  const cid = subdomainCid?.[1] || pathCid;
  if (cid && (IPFS_HOST.test(host) || host.endsWith(".mypinata.cloud") || host.includes(".ipfs."))) {
    return `https://ipfs.io/ipfs/${cid}`;
  }
  if (host === "cdn.dexscreener.com" && url.pathname.startsWith("/cms/images/")) return url.href;
  if (host === "ansem.io" && url.pathname.startsWith("/api/banners/")) return url.href;
  return null;
}
