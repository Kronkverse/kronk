import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl, defineMessages } from 'react-intl';

import { useHistory } from 'react-router-dom';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import ContentCopyIcon from '@/material-icons/400-24px/content_copy.svg?react';
import ShareIcon from '@/material-icons/400-24px/share.svg?react';
import { showAlert } from 'mastodon/actions/alerts';
import api from 'mastodon/api';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Icon } from 'mastodon/components/icon';
import { useAppDispatch } from 'mastodon/store';

// Kronk share primitive. Any surface that has a canonical URL can open
// this to share it three ways:
//
//   1. Send in Nudges — search Kronkers by handle/name → tap → the
//      Nudge thread opens with the link pre-attached as a post card
//      (uses the existing `attachStatusUrl` location-state contract
//      NudgesThread reads on mount).
//   2. Copy link — clipboard + toast confirmation.
//   3. Share… — native OS share sheet on capable browsers (mobile +
//      Safari desktop). Hidden when `navigator.share` isn't available.
//
// The sheet is a self-contained modal (backdrop + panel), not the
// Mastodon `openModal` system, so any component can drop it in
// without action/reducer wiring. Close on backdrop click, Escape, or
// after a Nudge navigation.

const DEBOUNCE_MS = 220;

const messages = defineMessages({
  title: { id: 'share_sheet.title', defaultMessage: 'Share' },
  copyLink: { id: 'share_sheet.copy_link', defaultMessage: 'Copy link' },
  share: { id: 'share_sheet.share', defaultMessage: 'Share…' },
  close: { id: 'share_sheet.close', defaultMessage: 'Close' },
  sendPrompt: {
    id: 'share_sheet.send_prompt',
    defaultMessage: 'Send to a Kronker',
  },
  searchPlaceholder: {
    id: 'share_sheet.search_placeholder',
    defaultMessage: 'Search by name or @handle…',
  },
  empty: {
    id: 'share_sheet.empty',
    defaultMessage: 'No one found. Try a different name.',
  },
  copied: { id: 'share_sheet.copied', defaultMessage: 'Link copied' },
});

interface ShareAuthor {
  name?: string;
  acct?: string;
  avatar?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
  body?: string | null;
  author?: ShareAuthor;
}

export const ShareSheet: React.FC<Props> = ({
  open,
  onClose,
  url,
  title,
  body,
  author,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const history = useHistory();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApiAccountJSON[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset query on open/close so a stale search doesn't linger.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSearching(false);
    } else {
      // Give the panel a beat to render before focusing.
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [open, onClose]);

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setQuery(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      const trimmed = next.trim();
      if (trimmed.length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      timerRef.current = setTimeout(() => {
        searchIdRef.current += 1;
        const id = searchIdRef.current;
        void api()
          .get<ApiAccountJSON[]>('/api/v1/accounts/search', {
            params: { q: trimmed, limit: 6, resolve: false },
          })
          .then((r) => {
            if (id !== searchIdRef.current) return;
            setResults(r.data);
            setSearching(false);
          })
          .catch(() => {
            if (id !== searchIdRef.current) return;
            setResults([]);
            setSearching(false);
          });
      }, DEBOUNCE_MS);
    },
    [],
  );

  const handleSelect = useCallback(
    (account: ApiAccountJSON) => {
      // Hand off to the Nudges thread with the link pre-attached via
      // the existing NudgeLocationState contract — the thread reads
      // `attachStatusUrl` (+ optional author metadata) on mount and
      // renders a post-share card in its compose bar.
      history.push(`/nudges/${account.id}`, {
        attachStatusUrl: url,
        attachStatusBody: body ?? title,
        attachStatusAuthorName: author?.name,
        attachStatusAuthorAcct: author?.acct,
        attachStatusAuthorAvatar: author?.avatar,
      });
      onClose();
    },
    [history, url, body, title, author, onClose],
  );

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(url);
    dispatch(showAlert({ message: messages.copied }));
  }, [dispatch, url]);

  const handleNativeShare = useCallback(() => {
    if (typeof navigator.share !== 'function') return;
    void navigator.share({ title, url });
    onClose();
  }, [title, url, onClose]);

  if (!open) return null;

  const canNativeShare = typeof navigator.share === 'function';

  return (
    <div className='share-sheet'>
      <button
        type='button'
        className='share-sheet__backdrop'
        onClick={onClose}
        aria-label={intl.formatMessage(messages.close)}
      />
      <div
        className='share-sheet__panel'
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-label={intl.formatMessage(messages.title)}
      >
        <div className='share-sheet__header'>
          <div className='share-sheet__title'>
            {intl.formatMessage(messages.title)}
            <span className='share-sheet__subject'>{title}</span>
          </div>
          <div className='share-sheet__header-actions'>
            <button
              type='button'
              className='share-sheet__action'
              onClick={handleCopy}
              title={intl.formatMessage(messages.copyLink)}
              aria-label={intl.formatMessage(messages.copyLink)}
            >
              <Icon id='content_copy' icon={ContentCopyIcon} />
            </button>
            {canNativeShare && (
              <button
                type='button'
                className='share-sheet__action'
                onClick={handleNativeShare}
                title={intl.formatMessage(messages.share)}
                aria-label={intl.formatMessage(messages.share)}
              >
                <Icon id='share' icon={ShareIcon} />
              </button>
            )}
            <button
              type='button'
              className='share-sheet__close'
              onClick={onClose}
              title={intl.formatMessage(messages.close)}
              aria-label={intl.formatMessage(messages.close)}
            >
              <Icon id='close' icon={CloseIcon} />
            </button>
          </div>
        </div>

        <div className='share-sheet__prompt'>
          {intl.formatMessage(messages.sendPrompt)}
        </div>

        <input
          ref={inputRef}
          type='text'
          className='share-sheet__search'
          value={query}
          onChange={handleQueryChange}
          placeholder={intl.formatMessage(messages.searchPlaceholder)}
        />

        <ul className='share-sheet__results'>
          {results.map((a) => (
            <ResultRow key={a.id} account={a} onSelect={handleSelect} />
          ))}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <li className='share-sheet__empty'>
              {intl.formatMessage(messages.empty)}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

const ResultRow: React.FC<{
  account: ApiAccountJSON;
  onSelect: (account: ApiAccountJSON) => void;
}> = ({ account, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(account);
  }, [account, onSelect]);
  return (
    <li>
      <button
        type='button'
        className='share-sheet__result'
        onClick={handleClick}
      >
        <img
          src={account.avatar}
          alt=''
          className='share-sheet__result-avatar'
        />
        <span className='share-sheet__result-name'>
          {account.display_name || account.username}
        </span>
        <span className='share-sheet__result-acct'>@{account.acct}</span>
      </button>
    </li>
  );
};
