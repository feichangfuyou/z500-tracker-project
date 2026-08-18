"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#07080c] px-6 text-center text-[#e8ecf2]">
        <p className="text-sm text-[#8d94a3]">Something broke</p>
        <p className="max-w-md text-pretty text-sm text-[#8d94a3]">The tracker hit an error. Try again.</p>
        <button
          type="button"
          onClick={reset}
          className="h-8 border border-[#4ade50] bg-[#4ade50] px-4 text-sm font-semibold text-black"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
