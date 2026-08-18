"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const MOTION_IN = { duration: 0.2, ease: "easeOut" } as const;

export function Reveal({
  show,
  children,
  className,
}: {
  show: boolean;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const t = reduce ? { duration: 0 } : MOTION_IN;
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -8 }}
          transition={t}
          className={className}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { ...MOTION_IN, delay }}
    >
      {children}
    </motion.div>
  );
}

export function Spin({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className={cn("inline-flex", className)}
      animate={{ rotate: open ? 180 : 0 }}
      transition={reduce ? { duration: 0 } : MOTION_IN}
    >
      {children}
    </motion.span>
  );
}
