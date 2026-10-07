// Moments grouped by person — the one order the Home strip and the viewer
// share, so "the next person" in the viewer is the next ring on the strip.
//
// Takes the active list as the API returns it (newest first) and keeps
// people in newest-activity order. For each person it picks where to start:
// their oldest unseen Moment, so you catch up in order, or their oldest once
// you've seen them all. `seen` is true only when every one of their Moments
// is seen. Your own Moments come first when `meFirst` is set.

interface Groupable {
  id: string;
  account: { id: string };
}

export interface MomentsPerson<M extends Groupable> {
  accountId: string;
  // Newest first, as received.
  moments: M[];
  open: M;
  seen: boolean;
}

export const groupMomentsByPerson = <M extends Groupable>(
  moments: M[],
  isSeen: (moment: M) => boolean,
  { me, meFirst = false }: { me?: string | null; meFirst?: boolean } = {},
): MomentsPerson<M>[] => {
  const byAccount = new Map<string, M[]>();
  for (const m of moments) {
    const list = byAccount.get(m.account.id);
    if (list) list.push(m);
    else byAccount.set(m.account.id, [m]);
  }

  const people: MomentsPerson<M>[] = [];
  for (const [accountId, list] of byAccount) {
    const first = list[0];
    if (!first) continue;
    const unseen = list.filter((m) => !isSeen(m));
    people.push({
      accountId,
      moments: list,
      open: unseen.at(-1) ?? list.at(-1) ?? first,
      seen: unseen.length === 0,
    });
  }

  if (!meFirst || !me) return people;
  return [
    ...people.filter((p) => p.accountId === me),
    ...people.filter((p) => p.accountId !== me),
  ];
};
