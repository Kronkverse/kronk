// Which results go first. Searching from inside a space puts that space's
// results ahead of the rest of Kronk, each part keeping the order it had.
export const spaceFirst = <T extends { korner?: string }>(
  rows: T[],
  space: string | null | undefined,
): { here: T[]; elsewhere: T[] } => {
  if (!space) return { here: [], elsewhere: rows };

  return {
    here: rows.filter((row) => row.korner === space),
    elsewhere: rows.filter((row) => row.korner !== space),
  };
};
