import { useCallback, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import Overlay from 'react-overlays/Overlay';

import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import DeleteIcon from '@/material-icons/400-24px/delete.svg?react';
import PersonIcon from '@/material-icons/400-24px/person.svg?react';
import { apiFtdAssign, apiFtdRemoveProject } from 'mastodon/api/freethedream';
import type {
  FtdAccount,
  FtdFractal,
  FtdProject,
} from 'mastodon/api_types/freethedream';
import { ConfirmDialog } from 'mastodon/components/confirm_dialog';
import { DropdownSelector } from 'mastodon/components/dropdown_selector';
import type { SelectItem } from 'mastodon/components/dropdown_selector';
import { IconButton } from 'mastodon/components/icon_button';
import { PeopleRow } from 'mastodon/components/people_row';

import { act } from './act';
import { ChecklistEntries, moveTargets } from './checklist';
import type { MoveTarget } from './checklist';
import { Section } from './shared';

// A Komponent's fractals (Kommons "Fractals", 2026-11-22: "Fractals are
// not new pages, they're just displayed checklists on this same page.
// Compartmentalised sections of the overall task that can be assigned to
// team members. Beneath each fractal is a checklist of things to do").
// Each is a section of the Komponent's page under its own checklist: its
// name, who it's assigned to, and its checklist. Anyone in the projekt
// assigns it; whoever made it removes it.

const messages = defineMessages({
  assign: { id: 'freethedream.fractal.assign', defaultMessage: 'Assign' },
  assignTo: {
    id: 'freethedream.fractal.assign_to',
    defaultMessage: 'Assign {title} to someone',
  },
  unassigned: {
    id: 'freethedream.fractal.unassigned',
    defaultMessage: 'Not assigned yet',
  },
  remove: {
    id: 'freethedream.fractal.remove',
    defaultMessage: 'Remove {title}',
  },
  removeTitle: {
    id: 'freethedream.fractal.remove_title',
    defaultMessage: 'Remove {title}?',
  },
  removeBody: {
    id: 'freethedream.fractal.remove_body',
    defaultMessage: 'Its checklist goes with it.',
  },
  removeConfirm: {
    id: 'freethedream.fractal.remove_confirm',
    defaultMessage: 'Remove',
  },
});

// Who to assign it to: everyone in the projekt, those it's assigned to
// ticked. Picking someone assigns them, or takes them off it.
const AssignPick: React.FC<{
  fractal: FtdFractal;
  members: FtdAccount[];
  onChange: () => void;
}> = ({ fractal, members, onChange }) => {
  const intl = useIntl();
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const assigned = useMemo(
    () => new Set(fractal.assignees.map((a) => a.id)),
    [fractal.assignees],
  );
  const items = useMemo<SelectItem[]>(
    () =>
      members.map((m) => ({
        value: m.id,
        text: m.display_name || m.acct,
        icon: assigned.has(m.id) ? 'check' : 'person',
        iconComponent: assigned.has(m.id) ? CheckIcon : PersonIcon,
      })),
    [members, assigned],
  );
  const handleToggle = useCallback(() => {
    setOpen((was) => !was);
  }, []);
  const handleClose = useCallback(() => {
    setOpen(false);
    button.current?.focus();
  }, []);
  const handlePick = useCallback(
    (accountId: string) => {
      setOpen(false);
      void act(
        apiFtdAssign(fractal.id, accountId, !assigned.has(accountId)),
      ).then(onChange);
    },
    [fractal.id, assigned, onChange],
  );

  return (
    <>
      <button
        ref={button}
        type='button'
        className='freethedream__button freethedream__button--small freethedream__button--quiet'
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-label={intl.formatMessage(messages.assignTo, {
          title: fractal.title,
        })}
        onClick={handleToggle}
      >
        {intl.formatMessage(messages.assign)}
      </button>
      <Overlay
        show={open}
        offset={[0, 4]}
        placement='bottom-end'
        onHide={handleClose}
        flip
        target={button.current}
        popperConfig={{ strategy: 'fixed' }}
      >
        {({ props, placement }) => (
          <div {...props} className='privacy-dropdown__overlay'>
            <div
              className={`dropdown-animation privacy-dropdown__dropdown freethedream-checklist__menu ${placement}`}
            >
              <DropdownSelector
                items={items}
                value=''
                onClose={handleClose}
                onChange={handlePick}
                classNamePrefix='privacy-dropdown'
              />
            </div>
          </div>
        )}
      </Overlay>
    </>
  );
};

const Fractal: React.FC<{
  fractal: FtdFractal;
  members: FtdAccount[];
  canAct: boolean;
  onChange: () => void;
  targets: MoveTarget[];
}> = ({ fractal, members, canAct, onChange, targets }) => {
  const intl = useIntl();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const askRemove = useCallback(() => {
    setConfirmRemove(true);
  }, []);
  const cancelRemove = useCallback(() => {
    setConfirmRemove(false);
  }, []);
  const handleRemove = useCallback(() => {
    setConfirmRemove(false);
    void act(apiFtdRemoveProject(fractal.id)).then(onChange);
  }, [fractal.id, onChange]);

  return (
    <div className='freethedream-fractal' id={`fractal-${fractal.id}`}>
      <Section
        title={fractal.title}
        aside={
          fractal.can.remove && (
            <IconButton
              className='freethedream-fractal__remove'
              icon='delete'
              iconComponent={DeleteIcon}
              title={intl.formatMessage(messages.remove, {
                title: fractal.title,
              })}
              onClick={askRemove}
            />
          )
        }
      >
        {fractal.description && (
          <p className='freethedream-fractal__about'>{fractal.description}</p>
        )}
        <div className='freethedream-fractal__who'>
          {fractal.assignees.length > 0 ? (
            <PeopleRow people={fractal.assignees} max={4} />
          ) : (
            <span className='freethedream__quiet'>
              {intl.formatMessage(messages.unassigned)}
            </span>
          )}
          {canAct && members.length > 0 && (
            <AssignPick
              fractal={fractal}
              members={members}
              onChange={onChange}
            />
          )}
        </div>
        <ChecklistEntries
          projectId={fractal.id}
          items={fractal.items}
          canAct={canAct}
          onChange={onChange}
          targets={targets}
          members={members}
        />
      </Section>
      {confirmRemove && (
        <ConfirmDialog
          title={intl.formatMessage(messages.removeTitle, {
            title: fractal.title,
          })}
          message={intl.formatMessage(messages.removeBody)}
          confirmLabel={intl.formatMessage(messages.removeConfirm)}
          destructive
          onConfirm={handleRemove}
          onCancel={cancelRemove}
        />
      )}
    </div>
  );
};

export const Fractals: React.FC<{
  project: FtdProject;
  onChange: () => void;
  addLabel: string;
  onAdd?: () => void;
}> = ({ project, onChange, addLabel, onAdd }) => {
  const targets = moveTargets(project);

  return (
    <>
      {project.fractals.map((fractal) => (
        <Fractal
          key={fractal.id}
          fractal={fractal}
          members={project.members}
          canAct={project.can.add}
          onChange={onChange}
          targets={targets}
        />
      ))}
      {onAdd && (
        <button
          type='button'
          className='freethedream__button freethedream__button--quiet freethedream-fractal__add'
          onClick={onAdd}
        >
          {addLabel}
        </button>
      )}
    </>
  );
};
