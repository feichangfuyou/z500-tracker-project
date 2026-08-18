"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink, FileText } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/cn";

const SITE_NAV_MENU_ID = "site-nav-menu";
const DESKTOP_NAV = "(min-width: 1280px)";
const SHEET = { duration: 0.2, ease: "easeOut" } as const;

const LINKS = [
  { href: "/", text: "Board" },
  { href: "/guide", text: "Guide" },
  { href: "/index", text: "Index" },
  { href: "/wallets", text: "Wallets" },
  { href: "/airdrop", text: "Airdrop" },
  { href: "/partner", text: "Embed" },
  { href: "https://ansem.io/z500", text: "Official z500", external: true },
] as const;

function isCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isExternal(link: (typeof LINKS)[number]) {
  return "external" in link;
}

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*+/?<>";
const SCRAMBLE_STEP_MS = 25;

function useScramble(text: string) {
  const [display, setDisplay] = useState(text);
  const frame = useRef(0);

  useEffect(() => {
    setDisplay(text);
  }, [text]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const start = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    cancelAnimationFrame(frame.current);
    const began = performance.now();
    const tick = (now: number) => {
      const revealed = Math.floor((now - began) / SCRAMBLE_STEP_MS);
      if (revealed >= text.length) {
        setDisplay(text);
        return;
      }
      let next = "";
      for (let i = 0; i < text.length; i += 1) {
        next += i < revealed || text[i] === " " ? text[i]! : SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0]!;
      }
      setDisplay(next);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [text]);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    setDisplay(text);
  }, [text]);

  return { display, start, stop };
}

function ScrambleNavLink({
  href,
  text,
  className,
  external,
  current,
  onSelect,
}: {
  href: string;
  text: string;
  className?: string;
  external?: boolean;
  current?: boolean;
  onSelect?: (event: { preventDefault: () => void }) => void;
}) {
  const { display, start, stop } = useScramble(text);
  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);
  const label = (
    <>
      <span className="sr-only">{external ? `${text} (opens in new tab)` : text}</span>
      <span aria-hidden="true" className="flex min-w-0 items-center gap-2">
        {display}
        {external ? <ExternalLink size={12} strokeWidth={1.6} /> : null}
      </span>
    </>
  );
  const hover = {
    className,
    onPointerEnter: start,
    onPointerLeave: stop,
    onFocus: start,
    onBlur: stop,
    onClick: onSelect,
  };
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...hover}>
        {label}
      </a>
    );
  }
  return (
    <Link href={href} prefetch aria-current={current ? "page" : undefined} {...hover}>
      {label}
    </Link>
  );
}

function sheetLinkClass(pathname: string, href: string, external: boolean | undefined) {
  const current = !external && isCurrent(pathname, href);
  return cn(
    "type-nav flex min-h-10 items-center bg-panel px-3 py-3 text-muted transition-colors duration-150 hover:bg-raised hover:text-ink",
    current && "text-accent hover:text-accent",
  );
}

function barLinkClass(pathname: string, href: string, external: boolean | undefined) {
  const current = !external && isCurrent(pathname, href);
  return cn(
    "type-nav flex h-8 items-center whitespace-nowrap px-3 text-muted transition-colors duration-150 hover:text-ink",
    current && "text-accent hover:text-accent",
  );
}

function BurgerIcon({ open }: { open: boolean }) {
  const reduce = useReducedMotion();
  const t = reduce ? { duration: 0 } : SHEET;
  return (
    <span className="relative block size-4">
      <motion.span
        className="absolute inset-x-0.5 top-[7px] h-px bg-current"
        animate={open ? { rotate: 45, y: 0 } : { rotate: 0, y: -3.5 }}
        transition={t}
      />
      <motion.span
        className="absolute inset-x-0.5 top-[7px] h-px bg-current"
        animate={{ opacity: open ? 0 : 1 }}
        transition={t}
      />
      <motion.span
        className="absolute inset-x-0.5 top-[7px] h-px bg-current"
        animate={open ? { rotate: -45, y: 0 } : { rotate: 0, y: 3.5 }}
        transition={t}
      />
    </span>
  );
}

export function SiteHeader({ children, className }: { children?: ReactNode; className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const sheet = reduce ? { duration: 0 } : SHEET;

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_NAV);
    const closeOnDesktop = () => {
      if (mq.matches) setMenuOpen(false);
    };
    closeOnDesktop();
    mq.addEventListener("change", closeOnDesktop);
    return () => mq.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    for (const link of LINKS) {
      if (!isExternal(link)) router.prefetch(link.href);
    }
  }, [router]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      burgerRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const node = event.target as Node | null;
      if (node && headerRef.current?.contains(node)) return;
      setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);

  return (
    <header ref={headerRef} className={cn("sticky top-0 bg-bg", className)} style={{ zIndex: "var(--z-header)" }}>
      <AnimatePresence>
        {menuOpen ? (
          <div key={SITE_NAV_MENU_ID} className="absolute inset-x-0 top-full overflow-hidden xl:hidden">
            <motion.nav
              id={SITE_NAV_MENU_ID}
              className="bg-border"
              aria-label="Pages"
              initial={reduce ? false : { y: "-100%" }}
              animate={{ y: 0 }}
              exit={reduce ? undefined : { y: "-100%" }}
              transition={sheet}
            >
              <div className="gutter-x mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-px py-px min-[400px]:grid-cols-2">
                {LINKS.map((link) => (
                  <ScrambleNavLink
                    key={link.href}
                    href={link.href}
                    text={link.text}
                    external={isExternal(link)}
                    current={!isExternal(link) && isCurrent(pathname, link.href)}
                    className={sheetLinkClass(pathname, link.href, isExternal(link))}
                    onSelect={(event) => {
                      if (isExternal(link)) {
                        setMenuOpen(false);
                        return;
                      }
                      if (isCurrent(pathname, link.href)) {
                        event.preventDefault();
                        setMenuOpen(false);
                      }
                    }}
                  />
                ))}
              </div>
            </motion.nav>
          </div>
        ) : null}
      </AnimatePresence>
      <div className="relative border-b border-border bg-bg pt-[env(safe-area-inset-top)]">
        <div className="gutter-x mx-auto flex h-16 w-full min-w-0 max-w-[1400px] items-center gap-2 sm:gap-4">
          <Link href="/" className="flex min-w-0 shrink items-center gap-2">
            <BrandMark className="size-7 shrink-0" />
            <span className="display hidden whitespace-nowrap text-[15px] leading-[13px] text-ink min-[360px]:inline">
              CROSSCHECK
            </span>
          </Link>
          <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Pages">
            {LINKS.filter((link) => link.href !== "/guide").map((link) => (
              <ScrambleNavLink
                key={link.href}
                href={link.href}
                text={link.text}
                external={isExternal(link)}
                current={!isExternal(link) && isCurrent(pathname, link.href)}
                className={barLinkClass(pathname, link.href, isExternal(link))}
              />
            ))}
          </nav>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-4">
            <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-4">
              <Link
                href="/guide"
                prefetch
                aria-label="Guide"
                aria-current={isCurrent(pathname, "/guide") ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "grid size-10 shrink-0 place-items-center border border-border bg-panel text-muted hover:border-border-strong hover:text-ink sm:size-[31px]",
                  isCurrent(pathname, "/guide") && "text-accent hover:text-accent",
                )}
              >
                <FileText size={12} strokeWidth={1.6} />
              </Link>
              {children}
            </div>
            <button
              ref={burgerRef}
              type="button"
              className="grid size-10 shrink-0 place-items-center border border-border-strong bg-transparent text-muted hover:text-ink sm:size-[34px] xl:hidden"
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
              aria-controls={SITE_NAV_MENU_ID}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <BurgerIcon open={menuOpen} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
