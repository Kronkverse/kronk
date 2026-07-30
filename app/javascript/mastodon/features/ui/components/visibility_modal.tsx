/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` in the KrewPicker useEffect cleanup mutates after the
 * async fetch reads it; TS control-flow doesn't track mutation across
 * the closure so `!cancelled` reads as always-truthy — but the guard
 * is load-bearing to prevent a setState after unmount. */

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import type { FC } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import classNames from 'classnames';

import { List as ImmutableList } from 'immutable';

import { changeComposeKrewTargets } from '@/mastodon/actions/compose';
import { apiRequestGet } from '@/mastodon/api';
import type { ApiKrewJSON } from '@/mastodon/api/krew';
import type { ApiQuotePolicy } from '@/mastodon/api_types/quotes';
import { isQuotePolicy } from '@/mastodon/api_types/quotes';
import { isStatusVisibility } from '@/mastodon/api_types/statuses';
import type { StatusVisibility } from '@/mastodon/api_types/statuses';
import { Button } from '@/mastodon/components/button';
import { Dropdown } from '@/mastodon/components/dropdown';
import type { SelectItem } from '@/mastodon/components/dropdown_selector';
import { IconButton } from '@/mastodon/components/icon_button';
import { messages as privacyMessages } from '@/mastodon/features/compose/components/privacy_dropdown';
import {
  createAppSelector,
  useAppDispatch,
  useAppSelector,
} from '@/mastodon/store';
import AlternateEmailIcon from '@/material-icons/400-24px/alternate_email.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import Diversity2Icon from '@/material-icons/400-24px/diversity_2.svg?react';
import GroupsIcon from '@/material-icons/400-24px/groups.svg?react';
import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import OrbitIcon from '@/material-icons/400-24px/orbit.svg?react';
import PublicIcon from '@/material-icons/400-24px/public.svg?react';

import type { BaseConfirmationModalProps } from './confirmation_modals/confirmation_modal';

const messages = defineMessages({
  close: { id: 'lightbox.close', defaultMessage: 'Close' },
  buttonTitle: {
    id: 'visibility_modal.button_title',
    defaultMessage: 'Set visibility',
  },
  quotePublic: {
    id: 'visibility_modal.quote_public',
    defaultMessage: 'Anyone',
  },
  quoteFollowers: {
    id: 'visibility_modal.quote_followers',
    defaultMessage: 'Followers only',
  },
  quoteNobody: {
    id: 'visibility_modal.quote_nobody',
    defaultMessage: 'Just me',
  },
  krewPickerLabel: {
    id: 'visibility_modal.krew_picker_label',
    defaultMessage: 'Which Krews',
  },
  krewPickerLoading: {
    id: 'visibility_modal.krew_picker_loading',
    defaultMessage: 'Loading your Krews…',
  },
  krewPickerEmpty: {
    id: 'visibility_modal.krew_picker_empty',
    defaultMessage: "You aren't in any Krews yet.",
  },
  krewPickerHelper: {
    id: 'visibility_modal.krew_picker_helper',
    defaultMessage:
      'Pick one or more Krews. Members of any picked Krew will see the post.',
  },
});

export type VisibilityModalCallback = (
  visibility: StatusVisibility,
  quotePolicy: ApiQuotePolicy,
) => void;

interface VisibilityModalProps extends BaseConfirmationModalProps {
  statusId?: string;
  onChange: VisibilityModalCallback;
}

const selectStatusPolicy = createAppSelector(
  [
    (state) => state.statuses,
    (_state, statusId?: string) => statusId,
    (state) => state.compose.get('quote_policy') as ApiQuotePolicy,
  ],
  (statuses, statusId, composeQuotePolicy) => {
    if (!statusId) {
      return composeQuotePolicy;
    }
    const status = statuses.get(statusId);
    if (!status) {
      return 'public';
    }
    const policy =
      (status.getIn(['quote_approval', 'automatic', 0]) as string) || 'nobody';
    const visibility = status.get('visibility') as StatusVisibility;

    // If the status is private/direct or a restricted reach scope, it
    // cannot be quoted by anyone.
    if (
      visibility === 'private' ||
      visibility === 'direct' ||
      visibility === 'mates' ||
      visibility === 'orbit' ||
      visibility === 'self_only'
    ) {
      return 'nobody';
    }

    // If the status has a specific quote policy, return it.
    if (isQuotePolicy(policy)) {
      return policy;
    }

    // Otherwise, return the default based on visibility.
    if (visibility === 'unlisted') {
      return 'followers';
    }
    return 'public';
  },
);

const selectDisablePublicVisibilities = createAppSelector(
  [
    (state) => state.statuses,
    (_state, statusId?: string) => !!statusId,
    (state) => state.compose.get('quoted_status_id') as string | null,
  ],
  (statuses, isEditing, statusId) => {
    if (isEditing || !statusId) return false;

    const status = statuses.get(statusId);
    if (!status) {
      return false;
    }

    return status.get('visibility') === 'private';
  },
);

export const VisibilityModal: FC<VisibilityModalProps> = forwardRef(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ({ onClose, onChange, statusId }, _ref) => {
    const intl = useIntl();
    const currentVisibility = useAppSelector((state) =>
      statusId
        ? ((state.statuses.getIn([statusId, 'visibility'], 'public') as
            | StatusVisibility
            | undefined) ?? 'public')
        : (state.compose.get('privacy') as StatusVisibility),
    );
    const currentQuotePolicy = useAppSelector((state) =>
      selectStatusPolicy(state, statusId),
    );

    const [visibility, setVisibility] = useState(currentVisibility);
    const [quotePolicy, setQuotePolicy] = useState(currentQuotePolicy);

    const disableVisibility = !!statusId;
    const disableQuotePolicy =
      visibility === 'private' ||
      visibility === 'direct' ||
      visibility === 'krew' ||
      visibility === 'mates' ||
      visibility === 'orbit' ||
      visibility === 'self_only';
    const disablePublicVisibilities = useAppSelector(
      selectDisablePublicVisibilities,
    );
    const isQuotePost = useAppSelector(
      (state) => state.compose.get('quoted_status_id') !== null,
    );

    const visibilityItems = useMemo<SelectItem<StatusVisibility>[]>(() => {
      // The Kronk reach ladder (docs/kronk_feed_and_reach.md §2), widest to
      // tightest, then Krew (a separate group-target axis) and Specific
      // people (DMs). The Mastodon "Followers" (private) and "Quiet public"
      // (unlisted) options are retired from the picker — existing posts
      // with those visibilities still render.
      const items: SelectItem<StatusVisibility>[] = [];

      if (!disablePublicVisibilities) {
        items.push(
          {
            value: 'public',
            text: intl.formatMessage(privacyMessages.public_short),
            meta: intl.formatMessage(privacyMessages.public_long),
            icon: 'globe',
            iconComponent: PublicIcon,
          },
          {
            value: 'orbit',
            text: intl.formatMessage(privacyMessages.orbit_short),
            meta: intl.formatMessage(privacyMessages.orbit_long),
            icon: 'orbit',
            iconComponent: OrbitIcon,
          },
          {
            value: 'mates',
            text: intl.formatMessage(privacyMessages.mates_short),
            meta: intl.formatMessage(privacyMessages.mates_long),
            icon: 'group',
            iconComponent: Diversity2Icon,
          },
        );
      }

      // Just me — the author's own timeline only. Always available.
      items.push({
        value: 'self_only',
        text: intl.formatMessage(privacyMessages.self_only_short),
        meta: intl.formatMessage(privacyMessages.self_only_long),
        icon: 'lock',
        iconComponent: LockIcon,
      });

      if (!disablePublicVisibilities) {
        // Krew — a separate group-target axis. Selecting it makes
        // KrewTargets in the composer the multi-select for which Krews
        // carry the post.
        items.push({
          value: 'krew',
          text: intl.formatMessage(privacyMessages.krew_short),
          meta: intl.formatMessage(privacyMessages.krew_long),
          icon: 'group',
          iconComponent: GroupsIcon,
        });
      }

      // Specific people — direct mentions (DMs). Always available.
      items.push({
        value: 'direct',
        text: intl.formatMessage(privacyMessages.direct_short),
        meta: intl.formatMessage(privacyMessages.direct_long),
        icon: 'at',
        iconComponent: AlternateEmailIcon,
      });

      return items;
    }, [intl, disablePublicVisibilities]);
    const quoteItems = useMemo<SelectItem<ApiQuotePolicy>[]>(
      () => [
        { value: 'public', text: intl.formatMessage(messages.quotePublic) },
        {
          value: 'followers',
          text: intl.formatMessage(messages.quoteFollowers),
        },
        { value: 'nobody', text: intl.formatMessage(messages.quoteNobody) },
      ],
      [intl],
    );

    const handleVisibilityChange = useCallback((value: string) => {
      if (isStatusVisibility(value)) {
        setVisibility(value);
      }
    }, []);
    const handleQuotePolicyChange = useCallback((value: string) => {
      if (isQuotePolicy(value)) {
        setQuotePolicy(value);
      }
    }, []);
    const handleSave = useCallback(() => {
      onChange(visibility, quotePolicy);
      onClose();
    }, [onChange, onClose, visibility, quotePolicy]);

    const uniqueId = useId();
    const visibilityLabelId = `${uniqueId}-visibility-label`;
    const visibilityDescriptionId = `${uniqueId}-visibility-desc`;
    const quoteLabelId = `${uniqueId}-quote-label`;
    const quoteDescriptionId = `${uniqueId}-quote-desc`;

    return (
      <div className='modal-root__modal dialog-modal visibility-modal'>
        <div className='dialog-modal__header'>
          <IconButton
            className='dialog-modal__header__close'
            title={intl.formatMessage(messages.close)}
            icon='times'
            iconComponent={CloseIcon}
            onClick={onClose}
          />
          <FormattedMessage
            id='visibility_modal.header'
            defaultMessage='Visibility and interaction'
          >
            {(chunks) => (
              <span className='dialog-modal__header__title'>{chunks}</span>
            )}
          </FormattedMessage>
        </div>
        <div className='dialog-modal__content'>
          <div className='dialog-modal__content__description'>
            <FormattedMessage
              id='visibility_modal.instructions'
              defaultMessage='Control who can interact with this post. You can also apply settings to all future posts by navigating to <link>Preferences > Posting defaults</link>.'
              values={{
                link: (chunks) => (
                  <a href='/settings/preferences/posting_defaults'>{chunks}</a>
                ),
              }}
              tagName='p'
            />
          </div>
          <div className='dialog-modal__content__form'>
            <div
              className={classNames('visibility-dropdown', {
                disabled: disableVisibility,
              })}
            >
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
              <label
                className='visibility-dropdown__label'
                id={visibilityLabelId}
              >
                <FormattedMessage
                  id='visibility_modal.privacy_label'
                  defaultMessage='Visibility'
                />
              </label>

              <Dropdown
                items={visibilityItems}
                current={visibility}
                onChange={handleVisibilityChange}
                labelId={visibilityLabelId}
                descriptionId={visibilityDescriptionId}
                classPrefix='visibility-dropdown'
                disabled={disableVisibility}
              />
              {!!statusId && (
                <p
                  className='visibility-dropdown__helper'
                  id='visibilityDescriptionId'
                >
                  <FormattedMessage
                    id='visibility_modal.helper.privacy_editing'
                    defaultMessage="Visibility can't be changed after a post is published."
                  />
                </p>
              )}
              {!statusId && disablePublicVisibilities && (
                <p
                  className='visibility-dropdown__helper'
                  id='visibilityDescriptionId'
                >
                  <FormattedMessage
                    id='visibility_modal.helper.privacy_private_self_quote'
                    defaultMessage='Self-quotes of private posts cannot be made public.'
                  />
                </p>
              )}
            </div>

            {visibility === 'krew' && !statusId && <KrewPicker />}

            <div
              className={classNames('visibility-dropdown', {
                disabled: disableQuotePolicy,
              })}
            >
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
              <label className='visibility-dropdown__label' id={quoteLabelId}>
                <FormattedMessage
                  id='visibility_modal.quote_label'
                  defaultMessage='Who can quote'
                />
              </label>

              <Dropdown
                items={quoteItems}
                current={disableQuotePolicy ? 'nobody' : quotePolicy}
                onChange={handleQuotePolicyChange}
                labelId={quoteLabelId}
                descriptionId={quoteDescriptionId}
                classPrefix='visibility-dropdown'
                disabled={disableQuotePolicy}
              />
              <QuotePolicyHelper
                policy={quotePolicy}
                visibility={visibility}
                className='visibility-dropdown__helper'
                id={quoteDescriptionId}
              />
            </div>

            {isQuotePost && visibility === 'direct' && (
              <div className='visibility-modal__quote-warning'>
                <FormattedMessage
                  id='visibility_modal.direct_quote_warning.title'
                  defaultMessage="Quotes can't be embedded in private mentions"
                  tagName='h3'
                />
                <FormattedMessage
                  id='visibility_modal.direct_quote_warning.text'
                  defaultMessage='If you save the current settings, the embedded quote will be converted to a link.'
                  tagName='p'
                />
              </div>
            )}
          </div>
          <div className='dialog-modal__content__actions'>
            <Button onClick={onClose} secondary>
              <FormattedMessage
                id='confirmation_modal.cancel'
                defaultMessage='Cancel'
              />
            </Button>
            <Button onClick={handleSave}>
              <FormattedMessage
                id='visibility_modal.save'
                defaultMessage='Save'
              />
            </Button>
          </div>
        </div>
      </div>
    );
  },
);
VisibilityModal.displayName = 'VisibilityModal';

const QuotePolicyHelper: FC<
  {
    policy: ApiQuotePolicy;
    visibility: StatusVisibility;
  } & React.ComponentPropsWithoutRef<'p'>
> = ({ policy, visibility, ...otherProps }) => {
  let hintText: React.ReactElement | undefined;

  if (visibility === 'unlisted' && policy !== 'nobody') {
    hintText = (
      <FormattedMessage
        id='visibility_modal.helper.unlisted_quoting'
        defaultMessage='When people quote you, their post will also be hidden from trending timelines.'
      />
    );
  }

  if (visibility === 'private') {
    hintText = (
      <FormattedMessage
        id='visibility_modal.helper.private_quoting'
        defaultMessage="Follower-only posts authored on Mastodon can't be quoted by others."
      />
    );
  }

  if (visibility === 'direct') {
    hintText = (
      <FormattedMessage
        id='visibility_modal.helper.direct_quoting'
        defaultMessage="Private mentions authored on Mastodon can't be quoted by others."
      />
    );
  }

  if (!hintText) {
    return null;
  }

  return <p {...otherProps}>{hintText}</p>;
};

// Inline Krew picker — appears in the visibility modal when the user
// selects 'krew'. Reads and writes the compose reducer's krew_ids
// directly so the selection is picked up by the compose form on Save.
// KRONK_KREWS §7.1: a Krew-scoped post carries at least one krew_id;
// PostStatusService rejects visibility='krew' with an empty list.
const KrewPicker: FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const selectedIds = useAppSelector(
    (state) =>
      (state.compose.get('krew_ids') ??
        ImmutableList()) as ImmutableList<string>,
  );

  const [available, setAvailable] = useState<ApiKrewJSON[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const krews = await apiRequestGet<ApiKrewJSON[]>('v1/krews', {
          limit: 100,
        });
        if (!cancelled) {
          setAvailable(
            krews.filter((k) => k.viewer_role !== null && !k.archived),
          );
        }
      } catch {
        // Best-effort — the empty state renders if this fails.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(
    (id: string) => {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : selectedIds.push(id);
      dispatch(changeComposeKrewTargets(next.toArray()));
    },
    [dispatch, selectedIds],
  );

  const handleToggleClick = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >(
    (e) => {
      const id = e.currentTarget.dataset.id;
      if (id) toggle(id);
    },
    [toggle],
  );

  return (
    <div className='visibility-dropdown krew-picker'>
      <p className='visibility-dropdown__label'>
        {intl.formatMessage(messages.krewPickerLabel)}
      </p>

      {!loaded && (
        <p className='visibility-dropdown__helper'>
          {intl.formatMessage(messages.krewPickerLoading)}
        </p>
      )}

      {loaded && available.length === 0 && (
        <p className='visibility-dropdown__helper'>
          {intl.formatMessage(messages.krewPickerEmpty)}
        </p>
      )}

      {loaded && available.length > 0 && (
        <>
          <ul className='krew-picker__list' role='group'>
            {available.map((k) => {
              const selected = selectedIds.includes(k.id);
              return (
                <li key={k.id}>
                  <button
                    type='button'
                    role='checkbox'
                    aria-checked={selected}
                    data-id={k.id}
                    onClick={handleToggleClick}
                    className={classNames('krew-picker__row', {
                      'krew-picker__row--active': selected,
                    })}
                  >
                    <span
                      className={classNames('krew-picker__check', {
                        'krew-picker__check--on': selected,
                      })}
                      aria-hidden='true'
                    />
                    <span className='krew-picker__name'>{k.name}</span>
                    <span className='krew-picker__meta'>
                      {k.member_count}{' '}
                      {k.member_count === 1 ? 'member' : 'members'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className='visibility-dropdown__helper'>
            {intl.formatMessage(messages.krewPickerHelper)}
          </p>
        </>
      )}
    </div>
  );
};
