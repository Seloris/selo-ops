// The totals of « Fichiers modifiés » (sessions-live FR-54, FR-55): a binary file's unknown lines count as none.
export interface FileCounts {
  added: number | null;
  removed: number | null;
  isUncommitted: boolean;
}

export function fileTotals(stats: readonly FileCounts[]): { added: number; removed: number; uncommitted: number } {
  return stats.reduce(
    (sum, s) => ({ added: sum.added + (s.added ?? 0), removed: sum.removed + (s.removed ?? 0), uncommitted: sum.uncommitted + (s.isUncommitted ? 1 : 0) }),
    { added: 0, removed: 0, uncommitted: 0 },
  );
}
