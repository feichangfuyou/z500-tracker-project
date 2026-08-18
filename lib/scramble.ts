"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*+/?<>";
const SCRAMBLE_STEP_MS = 25;

export function useScramble(text: string) {
  const [{ source, display }, setState] = useState({ source: text, display: text });
  const frame = useRef(0);
  if (source !== text) {
    setState({ source: text, display: text });
  }

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const start = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    cancelAnimationFrame(frame.current);
    const began = performance.now();
    const tick = (now: number) => {
      const revealed = Math.floor((now - began) / SCRAMBLE_STEP_MS);
      if (revealed >= text.length) {
        setState({ source: text, display: text });
        return;
      }
      let next = "";
      for (let i = 0; i < text.length; i += 1) {
        next += i < revealed || text[i] === " " ? text[i]! : SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0]!;
      }
      setState({ source: text, display: next });
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [text]);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    setState({ source: text, display: text });
  }, [text]);

  return { display, start, stop };
}
