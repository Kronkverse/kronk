import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

// SpaceHeaderOverride — lets a mounted route (e.g. Art) render its own
// header content into the Frame's SpaceHeader slot in place of the
// manifest-derived default that <AutoSpaceHeader> would otherwise
// produce. Provider lives on <Stage> so both <SpaceHeaderRow> (which
// hosts AutoSpaceHeader) and the route below it share the same slot.
//
// Consumers call `useSpaceHeaderOverride(node)` with a ReactNode; the
// override lasts as long as the effect is active. On unmount (or when
// the passed node becomes null) the slot clears and AutoSpaceHeader
// falls back to its default output.

interface OverrideCtx {
  node: ReactNode | null;
  setNode: (n: ReactNode | null) => void;
}

const Ctx = createContext<OverrideCtx>({
  node: null,
  setNode: () => undefined,
});

export const SpaceHeaderOverrideProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [node, setNode] = useState<ReactNode | null>(null);
  const value = useMemo(() => ({ node, setNode }), [node]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

// Push `node` into the Frame's header slot while this hook is mounted.
// Pass null to leave the slot alone (default), or clear a previously-
// set override without unmounting the caller.
export const useSpaceHeaderOverride = (node: ReactNode | null): void => {
  const { setNode } = useContext(Ctx);
  useEffect(() => {
    setNode(node);
    return () => {
      setNode(null);
    };
  }, [node, setNode]);
};

// Read the current override — used by AutoSpaceHeader to decide whether
// to render the manifest default or defer to the consumer.
export const useSpaceHeaderOverrideValue = (): ReactNode | null => {
  return useContext(Ctx).node;
};
