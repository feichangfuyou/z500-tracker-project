"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink, FileText, Plus, Search, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { ScrambleText } from "@/components/scramble-text";
import { cn } from "@/lib/cn";
import { useScramble } from "@/lib/scramble";
import {
  getHeaderChrome,
  getHeaderChromeServer,
  readHeaderChromeFromLocation,
  setHeaderAdd,
  setHeaderQuery,
  subscribeHeaderChrome,
} from "@/lib/header-chrome";

const SITE_NAV_MENU_ID = "site-nav-menu";
const DESKTOP_NAV = "(min-width: 1280px)";
const SHEET = { duration: 0.2, ease: "easeOut" } as const;

let guideReturnTo = "/";

const LINKS = [
  { href: "/", text: "Board" },
  { href: "/radar", text: "Radar" },
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

function HeaderSearch({ className, onSubmit }: { className?: string; onSubmit?: () => void }) {
  const { query } = useSyncExternalStore(subscribeHeaderChrome, getHeaderChrome, getHeaderChromeServer);
  return (
    <label className={cn("search", className)}>
      <span className="sr-only">Search</span>
      <Search size={13} className="shrink-0 text-dim" />
      <input
        value={query}
        onChange={(event) => setHeaderQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit?.();
        }}
        placeholder="Search name or ticker"
        className="min-w-0 flex-1 bg-transparent font-mono text-base text-ink outline-none sm:text-[11px]"
      />
    </label>
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
  const [menuPath, setMenuPath] = useState(pathname);
  const headerRef = useRef<HTMLElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const sheet = reduce ? { duration: 0 } : SHEET;
  const { addOpen } = useSyncExternalStore(subscribeHeaderChrome, getHeaderChrome, getHeaderChromeServer);
  const home = pathname === "/";
  const onGuide = isCurrent(pathname, "/guide");
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    if (menuOpen) setMenuOpen(false);
  }

  useEffect(() => {
    readHeaderChromeFromLocation();
  }, [pathname]);

  useEffect(() => {
    if (!home) setHeaderAdd(false);
  }, [home]);

  useEffect(() => {
    if (!onGuide) guideReturnTo = `${pathname}${window.location.search}`;
  }, [onGuide, pathname]);

  const goSearch = useCallback(() => {
    if (home) {
      document.getElementById("board")?.scrollIntoView({ block: "start" });
      return;
    }
    const params = new URLSearchParams();
    const next = getHeaderChrome().query.trim();
    if (next) params.set("q", next);
    router.push(params.toString() ? `/?${params}` : "/");
  }, [home, router]);

  const goAdd = useCallback(() => {
    if (home) {
      setHeaderAdd(!getHeaderChrome().addOpen);
      return;
    }
    setHeaderAdd(true);
    const params = new URLSearchParams();
    const next = getHeaderChrome().query.trim();
    if (next) params.set("q", next);
    params.set("add", "1");
    router.push(`/?${params}`);
  }, [home, router]);

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
              <div className="gutter-x mx-auto w-full max-w-[1400px]">
                <div className="bg-bg py-3 md:hidden">
                  <HeaderSearch
                    onSubmit={() => {
                      goSearch();
                      setMenuOpen(false);
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 gap-px py-px min-[400px]:grid-cols-2">
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
              <ScrambleText text="CROSSCHECK" />
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
            <button
              type="button"
              aria-label={onGuide ? "Close guide" : "Guide"}
              aria-pressed={onGuide}
              onClick={() => {
                setMenuOpen(false);
                if (onGuide) {
                  router.replace(guideReturnTo || "/");
                  return;
                }
                guideReturnTo = `${pathname}${window.location.search}`;
                router.push("/guide");
              }}
              className={cn(
                "grid size-10 shrink-0 place-items-center border border-border bg-panel text-muted hover:border-border-strong hover:text-ink sm:size-[31px]",
                onGuide && "text-accent hover:text-accent",
              )}
            >
              {onGuide ? <X size={12} /> : <FileText size={12} strokeWidth={1.6} />}
            </button>
            <HeaderSearch className="hidden min-w-0 max-w-[240px] flex-1 md:flex" onSubmit={goSearch} />
            {children}
            <button
              type="button"
              onClick={goAdd}
              aria-label={home && addOpen ? "Cancel" : "Add a missing coin"}
              className="type-btn inline-flex size-10 shrink-0 items-center justify-center border border-accent bg-accent font-semibold text-void hover:border-accent-hover hover:bg-accent-hover sm:size-auto sm:h-8 sm:gap-1.5 sm:px-3"
            >
              {home && addOpen ? <X size={12} /> : <Plus size={12} />}
              <span className="hidden sm:inline">
                <ScrambleText text={home && addOpen ? "Cancel" : "Add a coin"} />
              </span>
            </button>
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
