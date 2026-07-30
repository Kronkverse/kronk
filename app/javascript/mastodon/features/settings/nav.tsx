import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';
import type { MessageDescriptor } from 'react-intl';

import { Link } from 'react-router-dom';

import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import DownloadIcon from '@/material-icons/400-24px/download.svg?react';
import EditNoteIcon from '@/material-icons/400-24px/edit_note.svg?react';
import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import NotificationsIcon from '@/material-icons/400-24px/notifications.svg?react';
import PersonIcon from '@/material-icons/400-24px/person.svg?react';
import TuneIcon from '@/material-icons/400-24px/tune.svg?react';
import VisibilityIcon from '@/material-icons/400-24px/visibility.svg?react';
import { setKornerTunedIn } from 'mastodon/actions/korners';
import { apiRequestPost, apiRequestDelete } from 'mastodon/api';
import { apiGetKommonsNodes } from 'mastodon/api/kommons_nodes';
import type { ApiKommonsNode } from 'mastodon/api/kommons_nodes';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';
import { me } from 'mastodon/initial_state';
import { useAppDispatch } from 'mastodon/store';
import { useAppSelector } from 'mastodon/store';

// Shared navigation pieces for the settings surfaces (settings rebuild §4).
// The hub drills into a "You" list and a "Korners" list; both, plus the hub
// kards, share these row/section definitions so there is one source of truth.

export const navMessages = defineMessages({
  soon: { id: 'settings_hub.soon', defaultMessage: 'Soon' },
  profile: { id: 'settings_hub.profile', defaultMessage: 'Profile' },
  profileDesc: {
    id: 'settings_hub.profile_desc',
    defaultMessage: 'How your profile looks — the composer.',
  },
  account: { id: 'settings_hub.account', defaultMessage: 'Account & security' },
  accountDesc: {
    id: 'settings_hub.account_desc',
    defaultMessage: 'Email, password, two-factor, sessions, apps.',
  },
  appearance: {
    id: 'settings_hub.appearance',
    defaultMessage: 'Appearance & language',
  },
  appearanceDesc: {
    id: 'settings_hub.appearance_desc',
    defaultMessage: 'Theme, accent, fonts, motion — how Kronk looks to you.',
  },
  posting: { id: 'settings_hub.posting', defaultMessage: 'Posting' },
  postingDesc: {
    id: 'settings_hub.posting_desc',
    defaultMessage:
      'Defaults for new posts — visibility, language, sensitivity.',
  },
  privacy: {
    id: 'settings_hub.privacy',
    defaultMessage: 'Relationships & privacy',
  },
  privacyDesc: {
    id: 'settings_hub.privacy_desc',
    defaultMessage: 'Follower approval, who reaches you, filters and blocks.',
  },
  data: { id: 'settings_hub.data', defaultMessage: 'Data' },
  dataDesc: {
    id: 'settings_hub.data_desc',
    defaultMessage: 'Import and export your account data.',
  },
  notifications: {
    id: 'settings_hub.notifications',
    defaultMessage: 'Notifications',
  },
  notificationsDesc: {
    id: 'settings_hub.notifications_desc',
    defaultMessage: 'What reaches you, and how — plus Nudges.',
  },
});

type SvgComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export interface SectionDef {
  key: string;
  to?: string; // set once the section page ships; until then the row is "soon"
  Icon: SvgComponent;
  name: MessageDescriptor;
  desc: MessageDescriptor;
}

// Presentation for the "You" settings sections: icon + i18n label/desc, keyed
// by node id, in display order. The registry (kronk_nodes.yaml, via the kommons
// nodes API) drives WHICH sections exist and their route + lifecycle; this map
// only says how each looks. A section id absent from the registry drops out;
// one absent from this map is not rendered here (so the "You" list stays the
// curated personal set, not every settings.* node). See docs/kronk_settings_ia.md.
const YOU_PRESENTATION: {
  id: string;
  Icon: SvgComponent;
  name: MessageDescriptor;
  desc: MessageDescriptor;
}[] = [
  {
    id: 'settings.profile',
    Icon: PersonIcon,
    name: navMessages.profile,
    desc: navMessages.profileDesc,
  },
  {
    id: 'settings.account',
    Icon: LockIcon,
    name: navMessages.account,
    desc: navMessages.accountDesc,
  },
  {
    id: 'settings.appearance',
    Icon: TuneIcon,
    name: navMessages.appearance,
    desc: navMessages.appearanceDesc,
  },
  {
    id: 'settings.posting',
    Icon: EditNoteIcon,
    name: navMessages.posting,
    desc: navMessages.postingDesc,
  },
  {
    id: 'settings.privacy',
    Icon: VisibilityIcon,
    name: navMessages.privacy,
    desc: navMessages.privacyDesc,
  },
  {
    id: 'settings.data',
    Icon: DownloadIcon,
    name: navMessages.data,
    desc: navMessages.dataDesc,
  },
  {
    id: 'settings.notifications',
    Icon: NotificationsIcon,
    name: navMessages.notifications,
    desc: navMessages.notificationsDesc,
  },
];

// Derives the "You" settings sections from the Kommons Tree node registry.
// Each section shows only if its node is present; the row's route + soon-state
// come from the node's url + lifecycle. Replaces the old hardcoded YOU_SECTIONS
// so the nav can't drift from the registry (settings IA §5, item 6).
export const useSettingsSections = (): SectionDef[] => {
  const [nodes, setNodes] = useState<Record<string, ApiKommonsNode>>({});
  const myAccount = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );
  const myAcct = myAccount?.get('acct');

  useEffect(() => {
    let cancelled = false;

    void apiGetKommonsNodes()
      .then((res) => {
        if (cancelled) return;
        const map: Record<string, ApiKommonsNode> = {};
        for (const node of res.nodes) map[node.id] = node;
        setNodes(map);
      })
      .catch(() => {
        // Registry unreachable: leave empty; rows simply don't render.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return YOU_PRESENTATION.flatMap((p) => {
    const node = nodes[p.id];
    if (!node) return [];

    let to: string | undefined;
    if (node.lifecycle === 'live') {
      // Profile "settings" is the composer (owner-only /@:acct/edit).
      to =
        p.id === 'settings.profile'
          ? myAcct
            ? `/@${myAcct}/edit`
            : undefined
          : node.url;
    }

    return [{ key: p.id, to, Icon: p.Icon, name: p.name, desc: p.desc }];
  });
};

export const SectionRow: React.FC<{ section: SectionDef }> = ({ section }) => {
  const intl = useIntl();
  const { Icon, to } = section;

  const inner = (
    <>
      <span className='settings-nav__row-glyph' aria-hidden='true'>
        <Icon />
      </span>
      <span className='settings-nav__row-body'>
        <span className='settings-nav__row-name'>
          {intl.formatMessage(section.name)}
        </span>
        <span className='settings-nav__row-desc'>
          {intl.formatMessage(section.desc)}
        </span>
      </span>
      {to ? (
        <ChevronRightIcon
          className='settings-nav__row-chevron'
          aria-hidden='true'
        />
      ) : (
        <span className='settings-nav__row-soon'>
          {intl.formatMessage(navMessages.soon)}
        </span>
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className='settings-nav__row'>
        {inner}
      </Link>
    );
  }

  return (
    <div
      className='settings-nav__row settings-nav__row--soon'
      aria-disabled='true'
    >
      {inner}
    </div>
  );
};

const pillMessages = defineMessages({
  tuneIn: {
    id: 'settings_korners.tune_in',
    defaultMessage: 'Tune in to {name}',
  },
  tuneOut: {
    id: 'settings_korners.tune_out',
    defaultMessage: 'Tune out of {name}',
  },
});

// A bare toggle switch to tune in/out of a korner without leaving the Hub
// settings list. Optimistic: dispatches the new state (so every surface reading
// state.korners updates at once), fires the server call, and re-dispatches the
// old value on failure. It's a sibling of the row's Link (not nested in the
// anchor) and stops the click from also navigating into the korner's settings.
const TuneToggle: React.FC<{ korner: ApiKornerJSON }> = ({ korner }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const tunedIn = korner.tuned_in !== false;
  const [busy, setBusy] = useState(false);

  const handleToggle = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (busy) return;
      const next = !tunedIn;
      setBusy(true);
      dispatch(setKornerTunedIn({ slug: korner.slug, tunedIn: next }));
      const request = next
        ? apiRequestDelete(`v1/korners/${korner.slug}/tune_out`)
        : apiRequestPost(`v1/korners/${korner.slug}/tune_out`, {});
      request
        .catch(() => {
          dispatch(setKornerTunedIn({ slug: korner.slug, tunedIn }));
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [busy, tunedIn, korner.slug, dispatch],
  );

  const label = intl.formatMessage(
    tunedIn ? pillMessages.tuneOut : pillMessages.tuneIn,
    { name: korner.name },
  );

  return (
    <button
      type='button'
      className={classNames('settings-nav__toggle', {
        'settings-nav__toggle--on': tunedIn,
      })}
      onClick={handleToggle}
      aria-pressed={tunedIn}
      aria-label={label}
      title={label}
    >
      <span className='settings-nav__toggle-track' aria-hidden='true'>
        <span className='settings-nav__toggle-thumb' />
      </span>
    </button>
  );
};

export const KornerRow: React.FC<{ korner: ApiKornerJSON }> = ({ korner }) => {
  const Icon = useKornerIcon(korner.slug);
  const live = korner.enforced !== false;
  const tunedIn = korner.tuned_in !== false;

  return (
    <div
      className={classNames('settings-nav__row settings-nav__row--korner', {
        // Tuned-out korners grey right down; not-yet-live ones read as "soon".
        'settings-nav__row--muted': live && !tunedIn,
        'settings-nav__row--soon': !live,
      })}
    >
      <Link
        to={`/hub/${korner.slug}/settings`}
        className='settings-nav__row-link'
      >
        <span className='settings-nav__row-glyph' aria-hidden='true'>
          <Icon />
        </span>
        <span className='settings-nav__row-body'>
          <span className='settings-nav__row-name'>{korner.name}</span>
        </span>
        <ChevronRightIcon
          className='settings-nav__row-chevron'
          aria-hidden='true'
        />
      </Link>
      {/* Coming-soon korners can't be tuned into yet — no toggle. */}
      {live && <TuneToggle korner={korner} />}
    </div>
  );
};
