import { describe, expect, it } from "vitest";
import { publicImageUrl } from "./media";

describe("publicImageUrl", () => {
  it("rewrites IPFS gateways and protocols onto ipfs.io", () => {
    const cid = "bafkreifk5tpndk6lj5csnhybvhpaqy2clmy6bzyvwnu2mslo5xcm3pyn44";
    const out = `https://ipfs.io/ipfs/${cid}`;
    expect(publicImageUrl(`https://ipfs.io/ipfs/${cid}`)).toBe(out);
    expect(publicImageUrl(`https://gateway.pinata.cloud/ipfs/${cid}`)).toBe(out);
    expect(publicImageUrl(`https://pump.mypinata.cloud/ipfs/${cid}`)).toBe(out);
    expect(publicImageUrl(`https://${cid}.ipfs.dweb.link`)).toBe(out);
    expect(publicImageUrl(`ipfs://${cid}`)).toBe(out);
    expect(publicImageUrl(`ipfs://ipfs/${cid}`)).toBe(out);
    expect(publicImageUrl(cid)).toBe(out);
  });

  it("keeps DexScreener and ansem.io https URLs", () => {
    expect(publicImageUrl("https://cdn.dexscreener.com/cms/images/abc")).toBe(
      "https://cdn.dexscreener.com/cms/images/abc",
    );
    expect(publicImageUrl("https://ansem.io/api/banners/abc")).toBe("https://ansem.io/api/banners/abc");
    expect(publicImageUrl("https://ansem.io/x")).toBeNull();
  });

  it("drops unsafe or unknown sources", () => {
    expect(publicImageUrl("javascript:alert(1)")).toBeNull();
    expect(publicImageUrl("http://ipfs.io/ipfs/bafkreifk5tpndk6lj5csnhybvhpaqy2clmy6bzyvwnu2mslo5xcm3pyn44")).toBeNull();
    expect(publicImageUrl("https://evil.example/ipfs/bafkreifk5tpndk6lj5csnhybvhpaqy2clmy6bzyvwnu2mslo5xcm3pyn44")).toBeNull();
    expect(publicImageUrl("  ")).toBeNull();
    expect(publicImageUrl(null)).toBeNull();
  });
});
