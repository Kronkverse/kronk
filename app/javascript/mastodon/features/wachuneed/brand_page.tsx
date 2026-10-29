import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useHistory, useLocation, useParams } from 'react-router-dom';

import { isAxiosError } from 'axios';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import {
  apiBackWachuneedBrand,
  apiGetWachuneedBrand,
  apiRemoveWachuneedBrand,
  apiUnbackWachuneedBrand,
} from 'mastodon/api/wachuneed_brands';
import type { ApiBrandJSON } from 'mastodon/api/wachuneed_brands';
import { Avatar } from 'mastodon/components/avatar';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { Stage } from 'mastodon/components/stage';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';

import { brandCategoryMessages } from './brand_card';
import { BrandComposer } from './brand_composer';

// /hub/wachuneed/brands/:id — one brand (docs/spaces/wachuneed.md, Brands),
// on the standard detail shell (`<KornerDetail>`): its picture as the hero,
// its name as the title, then a facts line with its website (opening in a
// new tab), its category, how many back it and who proposed it. One
// action, Back this brand (Backed, to take it back); the proposer backs it
// from the start. Then why we back them, and the faces of who does.
//
// The proposer changes it from Edit on the Ж menu, which opens the brand
// composer over the page (`?edit=1`), where it can also be taken down.
// Staff who handle reports see Remove instead.

const BRANDS_PATH = '/hub/wachuneed/brands';

const messages = defineMessages({
  title: { id: 'wachuneed.title', defaultMessage: 'Wachuneed' },
  loading: {
    id: 'wachuneed.brand.loading',
    defaultMessage: 'Loading brand…',
  },
  gone: { id: 'wachuneed.brand.gone', defaultMessage: "This brand isn't here" },
  goneBody: {
    id: 'wachuneed.brand.gone.body',
    defaultMessage: 'It may have been taken down.',
  },
  back: { id: 'wachuneed.brand.back', defaultMessage: 'Back to Brands' },
  edit: { id: 'wachuneed.brand.edit', defaultMessage: 'Edit brand' },
  proposedBy: {
    id: 'wachuneed.brand.proposed_by',
    defaultMessage: 'Proposed by {name}',
  },
  backers: {
    id: 'wachuneed.brands.backers',
    defaultMessage: '{count, plural, one {# backer} other {# backers}}',
  },
  gathering: {
    id: 'wachuneed.brands.gathering',
    defaultMessage: '{count} of {needed} backers',
  },
  waiting: {
    id: 'wachuneed.brand.waiting',
    defaultMessage:
      '{count, plural, one {Needs # more backer to join Brands.} other {Needs # more backers to join Brands.}}',
  },
  backIt: { id: 'wachuneed.brand.back_it', defaultMessage: 'Back this brand' },
  backed: {
    id: 'wachuneed.brand.backed',
    defaultMessage: 'Backed · take it back',
  },
  yours: {
    id: 'wachuneed.brand.yours',
    defaultMessage: 'You proposed this, so you back it',
  },
  why: { id: 'wachuneed.brand.why', defaultMessage: 'Why we back them' },
  backedBy: { id: 'wachuneed.brand.backed_by', defaultMessage: 'Backed by' },
  backError: {
    id: 'wachuneed.brand.back_error',
    defaultMessage: "Couldn't change your backing. Try again?",
  },
  remove: { id: 'wachuneed.brand.remove', defaultMessage: 'Remove' },
  removeTitle: {
    id: 'wachuneed.brand.remove.title',
    defaultMessage: 'Remove {name} from Brands?',
  },
  removeBody: {
    id: 'wachuneed.brand.remove.body',
    defaultMessage:
      'It is taken down for everyone, with its backers. This can’t be undone.',
  },
  removeConfirm: {
    id: 'wachuneed.brand.remove.confirm',
    defaultMessage: 'Remove it',
  },
  removeCancel: {
    id: 'wachuneed.brand.remove.cancel',
    defaultMessage: 'Keep it',
  },
  removeError: {
    id: 'wachuneed.brand.remove.error',
    defaultMessage: "Couldn't remove the brand. Try again?",
  },
});

// The site's own name for the link: "zorali.com" for
// https://www.zorali.com/about.
const siteName = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const errorFrom = (e: unknown, fallback: string): string => {
  const said: unknown = isAxiosError(e)
    ? (e.response?.data as { error?: unknown } | undefined)?.error
    : null;
  return typeof said === 'string' ? said : fallback;
};

const BrandBody: React.FC<{ id: string }> = ({ id }) => {
  const intl = useIntl();
  const history = useHistory();
  const { search } = useLocation();
  const editing = new URLSearchParams(search).get('edit') === '1';
  const [confirmDialog, confirm] = useConfirmDialog();

  const [brand, setBrand] = useState<ApiBrandJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setBrand(null);

    apiGetWachuneedBrand(id)
      .then((data) => {
        if (!cancelled) setBrand(data);
        return undefined;
      })
      .catch(() => {
        // Left null: the page says the brand isn't here.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const canEdit = !!brand?.can_edit;
  const handleEdit = useCallback(() => {
    history.push({ pathname: `${BRANDS_PATH}/${id}`, search: '?edit=1' });
  }, [history, id]);
  useRegisterPageAction(
    {
      key: 'edit',
      label: intl.formatMessage(messages.edit),
      icon: EditIcon,
      iconId: 'edit',
    },
    handleEdit,
    canEdit,
  );

  const handleEditCancel = useCallback(() => {
    history.replace(`${BRANDS_PATH}/${id}`);
  }, [history, id]);
  const handleEditSaved = useCallback(
    (saved: ApiBrandJSON | null) => {
      if (saved) {
        setBrand(saved);
        history.replace(`${BRANDS_PATH}/${id}`);
      } else {
        history.replace(BRANDS_PATH);
      }
    },
    [history, id],
  );

  const backed = !!brand?.backed;
  const backError = intl.formatMessage(messages.backError);
  const handleBack = useCallback(() => {
    setBusy(true);
    setError(null);

    (backed ? apiUnbackWachuneedBrand(id) : apiBackWachuneedBrand(id))
      .then((data) => {
        setBrand(data);
        return undefined;
      })
      .catch((e: unknown) => {
        setError(errorFrom(e, backError));
      })
      .finally(() => {
        setBusy(false);
      });
  }, [backed, backError, id]);

  const brandName = brand?.name ?? '';
  const removeError = intl.formatMessage(messages.removeError);
  const handleRemove = useCallback(() => {
    void (async () => {
      const ok = await confirm({
        title: intl.formatMessage(messages.removeTitle, { name: brandName }),
        message: intl.formatMessage(messages.removeBody),
        confirmLabel: intl.formatMessage(messages.removeConfirm),
        cancelLabel: intl.formatMessage(messages.removeCancel),
        destructive: true,
      });
      if (!ok) return;

      setBusy(true);
      setError(null);
      try {
        await apiRemoveWachuneedBrand(id);
        history.replace(BRANDS_PATH);
      } catch {
        setError(removeError);
        setBusy(false);
      }
    })();
  }, [brandName, confirm, history, id, intl, removeError]);

  if (loading) {
    return (
      <div className='stage-column'>
        <LoadingState label={intl.formatMessage(messages.loading)} />
      </div>
    );
  }

  if (!brand) {
    return (
      <div className='stage-column'>
        <EmptyState
          title={intl.formatMessage(messages.gone)}
          body={intl.formatMessage(messages.goneBody)}
          action={
            <Link to={BRANDS_PATH}>{intl.formatMessage(messages.back)}</Link>
          }
        />
      </div>
    );
  }

  const proposer = brand.account.display_name || `@${brand.account.acct}`;
  const missing = Math.max(brand.backers_to_list - brand.backers_count, 0);
  const backers = brand.backers ?? [];

  return (
    <>
      <KornerDetail
        className='wachuneed-brand'
        back={{ href: BRANDS_PATH, label: intl.formatMessage(messages.back) }}
        hero={
          brand.picture_url ? (
            <img
              src={brand.picture_url}
              alt=''
              className='wachuneed-brand__logo'
            />
          ) : null
        }
        banner={
          brand.listed ? null : (
            <p className='wachuneed-brand__waiting'>
              {intl.formatMessage(messages.waiting, { count: missing })}
            </p>
          )
        }
        title={brand.name}
        meta={
          <KornerMeta
            items={[
              <a
                key='site'
                href={brand.url}
                target='_blank'
                rel='noopener noreferrer nofollow'
              >
                {siteName(brand.url)}
              </a>,
              brand.category &&
                intl.formatMessage(brandCategoryMessages[brand.category]),
              brand.listed
                ? intl.formatMessage(messages.backers, {
                    count: brand.backers_count,
                  })
                : intl.formatMessage(messages.gathering, {
                    count: brand.backers_count,
                    needed: brand.backers_to_list,
                  }),
              <Link key='proposer' to={`/@${brand.account.acct}`}>
                {intl.formatMessage(messages.proposedBy, { name: proposer })}
              </Link>,
            ]}
          />
        }
        actions={
          <KornerActionBar align='center'>
            {canEdit ? (
              <KornerPill label={intl.formatMessage(messages.yours)} disabled />
            ) : (
              <KornerPill
                variant={backed ? 'default' : 'primary'}
                active={backed}
                label={intl.formatMessage(
                  backed ? messages.backed : messages.backIt,
                )}
                onClick={handleBack}
                disabled={busy}
              />
            )}
            {brand.can_remove && !canEdit && (
              <KornerPill
                variant='destructive'
                label={intl.formatMessage(messages.remove)}
                onClick={handleRemove}
                disabled={busy}
              />
            )}
          </KornerActionBar>
        }
      >
        {error && (
          <p className='wachuneed-brand__error' role='alert'>
            {error}
          </p>
        )}

        <h2 className='korner-section-heading'>
          {intl.formatMessage(messages.why)}
        </h2>
        <p className='wachuneed-brand__why'>{brand.why}</p>

        {backers.length > 0 && (
          <>
            <h2 className='korner-section-heading'>
              {intl.formatMessage(messages.backedBy)}
            </h2>
            <ul className='wachuneed-brand__faces'>
              {backers.map((face) => (
                <li key={face.id} title={face.display_name || face.acct}>
                  <Avatar account={face} size={40} withLink />
                </li>
              ))}
            </ul>
          </>
        )}
      </KornerDetail>

      {confirmDialog}

      {editing && canEdit && (
        <BrandComposer
          editId={id}
          onCancel={handleEditCancel}
          onSaved={handleEditSaved}
        />
      )}
    </>
  );
};

const WachuneedBrand: React.FC<{ multiColumn?: boolean }> = () => {
  const { id } = useParams<{ id: string }>();
  const intl = useIntl();

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <BrandBody id={id} />
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default WachuneedBrand;
