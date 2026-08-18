import Image from "next/image";

export function CoinThumb({ src, label }: { src?: string | null; label: string }) {
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-[3px] border border-border bg-raised object-cover"
        unoptimized
      />
    );
  }
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-[3px] border border-border bg-raised font-mono text-xs text-dim">
      {label.slice(0, 1)}
    </span>
  );
}
