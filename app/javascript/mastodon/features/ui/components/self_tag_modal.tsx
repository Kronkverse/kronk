import { useState, useCallback, useRef, memo, useEffect } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { closeModal } from 'mastodon/actions/modal';
import api from 'mastodon/api';
import {
  apiAddMediaTag,
  apiGetMediaTags,
  apiRemoveMediaTag,
} from 'mastodon/api/media_tags';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import type { ApiMediaTagJSON } from 'mastodon/api_types/media_attachments';
import { Avatar } from 'mastodon/components/avatar';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const messages = defineMessages({
  title: { id: 'tag_media.title', defaultMessage: 'Tag people' },
  clickToPlace: {
    id: 'tag_media.click_to_place',
    defaultMessage: 'Click the photo to place a tag',
  },
  searchPlaceholder: {
    id: 'tag_media.search',
    defaultMessage: 'Search for a person…',
  },
  tagMyself: { id: 'tag_media.tag_myself', defaultMessage: 'Tag myself' },
  remove: { id: 'tag_media.remove', defaultMessage: 'Remove' },
  done: { id: 'tag_media.done', defaultMessage: 'Done' },
  alreadyTagged: {
    id: 'tag_media.already_tagged',
    defaultMessage: 'Already tagged',
  },
});

const SuggestionItem = memo<{
  account: ApiAccountJSON;
  onSelect: (account: ApiAccountJSON) => void;
}>(({ account, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(account);
  }, [account, onSelect]);
  return (
    <button
      type='button'
      className='tag-people-modal__suggestion-btn'
      onClick={handleClick}
    >
      <Avatar account={account as never} size={24} />
      <span>{account.display_name || account.username}</span>
      <span className='tag-people-modal__acct'>@{account.acct}</span>
    </button>
  );
});
SuggestionItem.displayName = 'SuggestionItem';

const RemoveTagButton = memo<{
  accountId: string;
  label: string;
  onRemove: (id: string) => void;
}>(({ accountId, label, onRemove }) => {
  const handleClick = useCallback(() => {
    onRemove(accountId);
  }, [accountId, onRemove]);
  return (
    <button
      type='button'
      className='tag-people-modal__remove-btn'
      onClick={handleClick}
      aria-label={label}
    >
      ×
    </button>
  );
});
RemoveTagButton.displayName = 'RemoveTagButton';

export const SelfTagModal: React.FC<{
  mediaId: string;
  previewUrl: string;
}> = ({ mediaId, previewUrl }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const myId = useAppSelector((state) => state.meta.get('me') as string);

  const imgRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [existingTags, setExistingTags] = useState<ApiMediaTagJSON[]>([]);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ApiAccountJSON[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing tags on open
  useEffect(() => {
    apiGetMediaTags(mediaId)
      .then(setExistingTags)
      .catch(() => undefined);
  }, [mediaId]);

  const close = useCallback(() => {
    dispatch(closeModal({ modalType: 'SELF_TAG', ignoreFocus: false }));
  }, [dispatch]);

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!imgRef.current) return;
      const rect = imgRef.current.getBoundingClientRect();
      setPendingPin({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });
      setQuery('');
      setSuggestions([]);
      setError(null);
    },
    [],
  );

  const handleImageKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') e.currentTarget.click();
    },
    [],
  );

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      if (value.trim().length < 2) {
        setSuggestions([]);
        return;
      }
      setSearching(true);
      searchTimeout.current = setTimeout(() => {
        void api()
          .get<ApiAccountJSON[]>('/api/v1/accounts/search', {
            params: { q: value, limit: 5 },
          })
          .then((r) => {
            setSuggestions(r.data);
            setSearching(false);
          })
          .catch(() => {
            setSearching(false);
          });
      }, 300);
    },
    [],
  );

  const applyTag = useCallback(
    (accountId: string, pinOverride?: { x: number; y: number }) => {
      const effectivePin = pinOverride ?? pendingPin;
      if (!effectivePin) return;
      const alreadyTagged = existingTags.some(
        (t) => t.account_id === accountId,
      );
      if (alreadyTagged) {
        setError(intl.formatMessage(messages.alreadyTagged));
        return;
      }
      const { x, y } = effectivePin;
      apiAddMediaTag(mediaId, accountId, x, y)
        .then((tag) => {
          setExistingTags((prev) => [...prev, tag]);
          setPendingPin(null);
          setQuery('');
          setSuggestions([]);
          setError(null);
        })
        .catch((err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })
            .response?.data?.error;
          setError(msg ?? 'Could not add tag');
        });
    },
    [pendingPin, existingTags, mediaId, intl],
  );

  const handleSelectAccount = useCallback(
    (account: ApiAccountJSON) => {
      applyTag(account.id);
    },
    [applyTag],
  );

  const handleTagMyself = useCallback(() => {
    if (!myId) return;
    const pin = pendingPin ?? { x: 0.5, y: 0.5 };
    if (!pendingPin) setPendingPin(pin);
    applyTag(myId, pin);
  }, [myId, pendingPin, applyTag]);

  const handleRemoveTag = useCallback(
    (accountId: string) => {
      apiRemoveMediaTag(mediaId, accountId)
        .then(() => {
          setExistingTags((prev) =>
            prev.filter((t) => t.account_id !== accountId),
          );
        })
        .catch(() => undefined);
    },
    [mediaId],
  );

  return (
    <div className='modal-root__modal tag-people-modal'>
      <div className='tag-people-modal__header'>
        <h3>{intl.formatMessage(messages.title)}</h3>
        <div className='tag-people-modal__header-actions'>
          {myId && (
            <button
              type='button'
              className='tag-people-modal__tag-myself-btn'
              onClick={handleTagMyself}
            >
              <FormattedMessage
                id='tag_media.tag_myself'
                defaultMessage='Tag myself'
              />
            </button>
          )}
        </div>
        <p className='tag-people-modal__hint'>
          {intl.formatMessage(messages.clickToPlace)}
        </p>
      </div>

      <div className='tag-people-modal__image-wrapper'>
        <div
          ref={imgRef}
          className='tag-people-modal__image'
          onClick={handleImageClick}
          role='button'
          tabIndex={0}
          aria-label={intl.formatMessage(messages.clickToPlace)}
          onKeyDown={handleImageKeyDown}
        >
          <img src={previewUrl} alt='' draggable={false} />

          {existingTags.map((tag) => (
            <div
              key={tag.account_id}
              className='tag-people-modal__pin'
              style={{ left: `${tag.x * 100}%`, top: `${tag.y * 100}%` }}
            >
              <span className='tag-people-modal__pin-label'>
                {(
                  tag.account as {
                    display_name?: string;
                    username?: string;
                  } | null
                )?.display_name ??
                  (tag.account as { username?: string } | null)?.username ??
                  ''}
              </span>
            </div>
          ))}

          {pendingPin && (
            <div
              className='tag-people-modal__pin tag-people-modal__pin--pending'
              style={{
                left: `${pendingPin.x * 100}%`,
                top: `${pendingPin.y * 100}%`,
              }}
            />
          )}
        </div>

        {pendingPin && (
          <div className='tag-people-modal__search'>
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              type='text'
              value={query}
              onChange={handleQueryChange}
              placeholder={intl.formatMessage(messages.searchPlaceholder)}
              className='tag-people-modal__search-input'
            />
            {searching && <div className='tag-people-modal__search-loading' />}
            {suggestions.length > 0 && (
              <ul className='tag-people-modal__suggestions'>
                {suggestions.map((acct) => (
                  <li key={acct.id}>
                    <SuggestionItem
                      account={acct}
                      onSelect={handleSelectAccount}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {error && <p className='tag-people-modal__error'>{error}</p>}
      </div>

      {existingTags.length > 0 && (
        <ul className='tag-people-modal__tag-list'>
          {existingTags.map((tag) => (
            <li key={tag.account_id}>
              <span>
                {(
                  tag.account as {
                    display_name?: string;
                    username?: string;
                  } | null
                )?.display_name ??
                  (tag.account as { username?: string } | null)?.username ??
                  tag.account_id}
              </span>
              <RemoveTagButton
                accountId={tag.account_id}
                label={intl.formatMessage(messages.remove)}
                onRemove={handleRemoveTag}
              />
            </li>
          ))}
        </ul>
      )}

      <div className='tag-people-modal__footer'>
        <button type='button' className='button' onClick={close}>
          {intl.formatMessage(messages.done)}
        </button>
      </div>
    </div>
  );
};
