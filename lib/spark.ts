export type SparkPoint = { x: number; y: number };

export function sparkScale(values: number[]) {
  const finite = values.filter((n) => Number.isFinite(n));
  if (!finite.length) return { min: 0, max: 1 };
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  return { min, max: max === min ? min + 1 : max };
}

/** Rank 1 sits at the top of the chart. */
export function rankToY(rank: number, minRank: number, maxRank: number, height: number, pad: number) {
  const span = Math.max(1, maxRank - minRank);
  return pad + ((rank - minRank) / span) * (height - pad * 2);
}

export function sparkPath(points: SparkPoint[]) {
  if (points.length < 2) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}

export function seriesPoints(
  values: Array<number | null | undefined>,
  width: number,
  height: number,
  pad: number,
  minRank: number,
  maxRank: number,
): SparkPoint[] {
  const last = Math.max(1, values.length - 1);
  const out: SparkPoint[] = [];
  values.forEach((rank, i) => {
    if (rank == null || !Number.isFinite(rank)) return;
    out.push({
      x: pad + (i / last) * (width - pad * 2),
      y: rankToY(rank, minRank, maxRank, height, pad),
    });
  });
  return out;
}
