import type { ComponentType, ReactNode, SVGProps } from 'react';
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

export interface PageAction {
  key: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconId: string;
  onClick: () => void;
}

interface Ctx {
  actions: PageAction[];
  register: (action: PageAction) => void;
  unregister: (key: string) => void;
}

const PageActionContext = createContext<Ctx>({
  actions: [],
  register: () => undefined,
  unregister: () => undefined,
});

export const PageActionProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [actions, setActions] = useState<PageAction[]>([]);

  const register = useCallback((action: PageAction) => {
    setActions((prev) => {
      const next = prev.filter((a) => a.key !== action.key);
      next.push(action);
      return next;
    });
  }, []);

  const unregister = useCallback((key: string) => {
    setActions((prev) => prev.filter((a) => a.key !== key));
  }, []);

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
    register({
      key: action.key,
      label: action.label,
      icon: action.icon,
      iconId: action.iconId,
      onClick: () => cbRef.current?.(),
    });
    return () => {
      unregister(action.key);
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
    register,
    unregister,
  ]);
};
