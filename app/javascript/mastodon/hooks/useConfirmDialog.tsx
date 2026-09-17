import { useCallback, useRef, useState } from 'react';

import { ConfirmDialog } from 'mastodon/components/confirm_dialog';

// useConfirmDialog — imperative Promise-returning wrapper around
// `<ConfirmDialog>`. For call sites where managing a state variable
// per confirmation adds noise. Returns a `[dialog, confirm]` pair:
//
//   const [confirmDialog, confirm] = useConfirmDialog();
//
//   const handleDelete = async () => {
//     const ok = await confirm({
//       title: 'Delete this event?',
//       message: 'It will disappear from everyone\'s Kalendar.',
//       confirmLabel: 'Delete',
//       destructive: true,
//     });
//     if (!ok) return;
//     await api().delete(...);
//   };
//
//   return <>{confirmDialog}...</>;
//
// The `dialog` node MUST be rendered somewhere in the tree — it's the
// portal-mounted `<ConfirmDialog>`. Rendering nothing when no dialog
// is open is handled internally.

interface ConfirmOptions {
  title: React.ReactNode;
  message?: React.ReactNode;
  confirmLabel: React.ReactNode;
  cancelLabel?: React.ReactNode;
  destructive?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

export const useConfirmDialog = (): [React.ReactNode, ConfirmFn] => {
  const [open, setOpen] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setOpen(opts);
      }),
    [],
  );

  const handleClose = useCallback((result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setOpen(null);
  }, []);

  const handleConfirm = useCallback(() => {
    handleClose(true);
  }, [handleClose]);

  const handleCancel = useCallback(() => {
    handleClose(false);
  }, [handleClose]);

  const dialog = open ? (
    <ConfirmDialog
      {...open}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return [dialog, confirm];
};
