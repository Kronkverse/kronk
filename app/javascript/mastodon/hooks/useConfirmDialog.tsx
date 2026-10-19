import { useCallback, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

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

const confirmLabels = defineMessages({
  delete: { id: 'confirm_dialog.delete', defaultMessage: 'Delete' },
  remove: { id: 'confirm_dialog.remove', defaultMessage: 'Remove' },
  leave: { id: 'confirm_dialog.leave', defaultMessage: 'Leave' },
  archive: { id: 'confirm_dialog.archive', defaultMessage: 'Archive' },
  clear: { id: 'confirm_dialog.clear', defaultMessage: 'Clear' },
  confirm: { id: 'confirm_dialog.confirm', defaultMessage: 'Yes' },
});

export type ConfirmKind = keyof typeof confirmLabels;

// The common case, as a drop-in for `if (!window.confirm(question)) return;`
// (which the Standard replaces with the shared dialog): ask one question,
// labelled by what the button does, and run `then` on yes.
//
//   const [confirmDialog, confirmThen] = useConfirmThen();
//   confirmThen(question, 'delete', () => { …the action… });
//   return <>{confirmDialog}…</>;
export const useConfirmThen = (): [
  React.ReactNode,
  (question: string, kind: ConfirmKind, then: () => void) => void,
] => {
  const intl = useIntl();
  const [dialog, confirm] = useConfirmDialog();

  const confirmThen = useCallback(
    (question: string, kind: ConfirmKind, then: () => void) => {
      void confirm({
        title: question,
        confirmLabel: intl.formatMessage(confirmLabels[kind]),
        destructive: kind !== 'confirm',
      }).then((ok) => {
        if (ok) then();
        return undefined;
      });
    },
    [confirm, intl],
  );

  return [dialog, confirmThen];
};
