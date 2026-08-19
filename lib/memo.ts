import type { HeliusTx } from "./helius";

export const MEMO_PROGRAM = "MemoSq4gqJC8NFXTxj6x7YhhVJXcmsuA";
export const MEMO_PROGRAM_LEGACY = "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo";

const ALPH = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const PRINTABLE = /^[\t\n\r\x20-\x7e]+$/;

type Ix = { programId?: string; accounts?: string[]; data?: string; innerInstructions?: Ix[] };

function isMemoProgram(id?: string) {
  return id === MEMO_PROGRAM || id === MEMO_PROGRAM_LEGACY;
}

export function encodeBase58(bytes: Uint8Array) {
  if (!bytes.length) return "";
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i]!;
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j]! * 256;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) out += ALPH[digits[i]!];
  return out;
}

export function decodeBase58(raw: string) {
  if (!raw) return null;
  const bytes = [0];
  for (const ch of raw) {
    let carry = ALPH.indexOf(ch);
    if (carry < 0) return null;
    for (let i = bytes.length - 1; i >= 0; i -= 1) {
      carry += bytes[i]! * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.unshift(carry & 0xff);
      carry >>= 8;
    }
  }
  let leading = 0;
  for (const ch of raw) {
    if (ch !== "1") break;
    leading += 1;
  }
  while (bytes.length > 1 && bytes[0] === 0) bytes.shift();
  const out = new Uint8Array(leading + bytes.length);
  out.set(bytes, leading);
  return out;
}

function utf8(bytes: Uint8Array) {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
    return text && PRINTABLE.test(text) ? text : null;
  } catch {
    return null;
  }
}

export function decodeMemoData(data: string | undefined) {
  if (!data) return null;
  const trimmed = data.trim();
  const from58 = decodeBase58(trimmed);
  if (from58) {
    const text = utf8(from58);
    if (text) return text;
  }
  if (/^[A-Za-z0-9+/]+=*$/.test(trimmed) && trimmed.length >= 12) {
    try {
      const from64 = Uint8Array.from(Buffer.from(trimmed, "base64"));
      const text = utf8(from64);
      if (text) return text;
    } catch {
      /* ignore */
    }
  }
  if (PRINTABLE.test(trimmed) && /[a-zA-Z0-9]/.test(trimmed)) return trimmed;
  return null;
}

export function flattenInstructions(tx: Pick<HeliusTx, "instructions"> & { innerInstructions?: Ix[] }) {
  const out: Ix[] = [];
  const walk = (ix: Ix | undefined) => {
    if (!ix) return;
    out.push(ix);
    for (const inner of ix.innerInstructions || []) walk(inner);
  };
  for (const ix of tx.instructions || []) walk(ix);
  for (const ix of tx.innerInstructions || []) walk(ix);
  return out;
}

export function memoTextsFromTx(tx: Pick<HeliusTx, "instructions" | "description"> & { innerInstructions?: Ix[] }) {
  const texts: string[] = [];
  const seen = new Set<string>();
  const push = (text: string | null | undefined) => {
    const value = (text || "").trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    texts.push(value);
  };
  for (const ix of flattenInstructions(tx)) {
    if (!isMemoProgram(ix.programId)) continue;
    push(decodeMemoData(ix.data));
  }
  return texts;
}
