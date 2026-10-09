import type { ComponentType, FC, ReactNode, SVGProps } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// Page actions — a shell-level registry that lets an arbitrary page
// contribute a moon to the Ж floating menu without the menu having
// to know about the page's model or ownership rules.
//
// The `compose:` action for a korner is declared in its manifest and
// resolved by `<KronkMenu>` directly — that's a per-*space* affordance,
// static per URL. Page actions are the per-*item* counterpart: a page
// (event_detail, krew_detail, proposal_page, etc.) that knows whether
// the current viewer can, say, edit *this specific record* registers a
// moon while it's mounted. The menu subscribes to the registry and
// renders each registered action as an additional moon.
//
// Actions unregister on unmount and on `enabled: false`, so a page
// navigating away drops its action cleanly.
//
// Registrations stack. An overlay (the Moments viewer, the album
// lightbox) registers `edit` over the page underneath it; while it is
// open its action is the one shown, and closing it brings the page's
// back. Each registration is removed by its own token, so an overlay
// unregistering never takes the page's action with it.
//
// `overlay: true` marks an action registered from something drawn above
// the page (a modal or full-screen viewer): the Ж menu lifts itself above
// that layer while such an action is showing, so its moon can be reached.

export interface PageAction {
  key: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconId: string;
  onClick: () => void;
  overlay?: boolean;
}

interface Registration {
  token: number;
  action: PageAction;
}

interface Ctx {
  actions: PageAction[];
  register: (action: PageAction) => number;
  unregister: (token: number) => void;
}

const PageActionContext = createContext<Ctx>({
  actions: [],
  register: () => 0,
  unregister: () => undefined,
});

export const PageActionProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const nextToken = useRef(1);

  const register = useCallback((action: PageAction) => {
    const token = nextToken.current++;
    setRegistrations((prev) => [...prev, { token, action }]);
    return token;
  }, []);

  const unregister = useCallback((token: number) => {
    setRegistrations((prev) => prev.filter((r) => r.token !== token));
  }, []);

  // One moon per key: the latest registration wins, in first-seen order.
  const actions = useMemo(() => {
    const latest = new Map<string, PageAction>();
    registrations.forEach(({ action }) => {
      latest.delete(action.key);
      latest.set(action.key, action);
    });
    return Array.from(latest.values());
  }, [registrations]);

  const value = useMemo(
    () => ({ actions, register, unregister }),
    [actions, register, unregister],
  );

  return (
    <PageActionContext.Provider value={value}>
      {children}
    </PageActionContext.Provider>
  );
};

// Consumer hook — read the current set of page actions (for the Ж menu).
export const usePageActions = (): PageAction[] =>
  useContext(PageActionContext).actions;

// Registration hook — a page passes its action + an `enabled` flag; the
// hook keeps the registry in sync as callbacks and enable-state change.
// The callback ref keeps a stable identity across re-renders so the menu
// doesn't re-render every parent tick.
export const useRegisterPageAction = (
  action: Omit<PageAction, 'onClick'> | null,
  onClick: (() => void) | null,
  enabled: boolean,
): void => {
  const { register, unregister } = useContext(PageActionContext);
  const cbRef = useRef<(() => void) | null>(onClick);
  cbRef.current = onClick;

  useEffect(() => {
    if (!enabled || !action || !onClick) return;
    const token = register({
      key: action.key,
      label: action.label,
      icon: action.icon,
      iconId: action.iconId,
      overlay: action.overlay,
      onClick: () => cbRef.current?.(),
    });
    return () => {
      unregister(token);
    };
    // We intentionally reference `action` fields individually so a caller
    // rebuilding the object each render doesn't churn the registry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    action?.key,
    action?.label,
    action?.icon,
    action?.iconId,
    action?.overlay,
    register,
    unregister,
  ]);
};

// Component form of `useRegisterPageAction`, for pages that can't call a
// hook themselves (class components such as the post detail view). Renders
// nothing; registers while mounted and enabled.
export const PageActionRegistrar: FC<{
  action: Omit<PageAction, 'onClick'>;
  onClick: () => void;
  enabled: boolean;
}> = ({ action, onClick, enabled }) => {
  useRegisterPageAction(action, onClick, enabled);
  return null;
};
