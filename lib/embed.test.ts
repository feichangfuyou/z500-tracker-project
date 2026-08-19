import { describe, expect, it } from "vitest";
import {
  burnLine,
  chipLine,
  crosscheckRankFromDelta,
  deltaLine,
  embedPath,
  EMBED_CREDIT,
  iframeSnippet,
  parseEmbedVariant,
} from "./embed";

describe("parseEmbedVariant", () => {
  it("defaults to card and rejects junk", () => {
    expect(parseEmbedVariant(undefined)).toBe("card");
    expect(parseEmbedVariant("burn")).toBe("burn");
    expect(parseEmbedVariant("nope")).toBe("card");
  });
});

describe("iframeSnippet", () => {
  it("emits sized iframe with a sanitized title", () => {
    const html = iframeSnippet("https://x.test", "Mint1", "burn", 'Frog <script> "x"');
    expect(html).toContain('src="https://x.test/embed/Mint1?v=burn"');
    expect(html).toContain('width="360"');
    expect(html).toContain('height="88"');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('"x"');
  });

  it("omits the query on the dossier card", () => {
    expect(embedPath("Mint1")).toBe("/embed/Mint1");
  });
});

describe("badge copy", () => {
  it("formats burn, delta, and chip fallbacks", () => {
    expect(burnLine({ verifiedBurn: 12400 })).toContain("12.4K");
    expect(burnLine({ verifiedBurn: null })).toBe("Burns not verified");
    expect(burnLine({ verifiedBurn: 0, listedBurn: 370_566 })).toContain("370.6K");
    expect(crosscheckRankFromDelta({ officialRank: 8, officialDelta: 5 })).toBe(3);
    expect(deltaLine({ officialRank: 8, officialDelta: 5 })).toBe("Listed #8 · Crosscheck #3");
    expect(chipLine({ verifiedBurn: 10, officialRank: 1, officialDelta: 0, flags: [], ticker: "A", name: "A", mint: "m", slug: "a", score: 1 })).toContain("$ANSEM");
    expect(EMBED_CREDIT).toContain("launched on ansem.io");
  });
});
