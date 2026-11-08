import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { useHistory, useLocation, useParams } from 'react-router-dom';

import {
  apiCloseWachuneedListing,
  apiCreateWachuneedListing,
  apiGetWachuneedListing,
  apiUpdateWachuneedListing,
} from 'mastodon/api/wachuneed';
import type { CreateListingParams } from 'mastodon/api/wachuneed';
import { apiGetMyWachuneedShop } from 'mastodon/api/wachuneed_shops';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import type { ListingVisibility } from 'mastodon/api_types/wachuneed';
import {
  ComposeBody,
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeRow,
  ComposeTitle,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { LoadingState } from 'mastodon/components/loading_state';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import { useAvailableKrews } from 'mastodon/hooks/useAvailableKrews';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';
import { useDraft } from 'mastodon/hooks/useDraft';
import { useKonnect } from 'mastodon/hooks/useKonnect';
import { useKonnectReturn } from 'mastodon/hooks/useKonnectReturn';
import { useSameAs } from 'mastodon/hooks/useSameAs';

import Wachuneed from './index';
import ListingDetail from './listing_detail';
import { ListingPhotoField, useListingPhotos } from './listing_photo_field';
import {
  hasVariants,
  variantStateFrom,
  variantValues,
} from './listing_variants_editor';

// The listing composer (docs/spaces/wachuneed.md, Listing): a new listing,
// on offer or wanted (Desired), or one of yours to change. It is the
// standard composer overlay (`<ComposeShell>`, decisions.md 2026-08-12).
//
//   /hub/wachuneed/new                → a new listing over Wachuneed's home;
//                                       `?kind=wanted` makes a wanted ad
//   /hub/wachuneed/listings/:id/edit  → the same composer, prefilled, over
//                                       the listing's page (the server
//                                       refuses anyone but its poster)
//
// It asks for photos, name, description and price (a budget, when wanted),
// and nothing else (Tal, 2026-11-08: "keep things basic and simple"). Who
// can see it is the reach control in the header. Shop sections,
// availability, variations, options and booking are not asked here: a
// listing that already has them keeps them when edited, because the edit
// sends only the fields this composer owns.

type Kind = 'offer' | 'wanted';

const messages = defineMessages({
  title: { id: 'wachuneed.new.title', defaultMessage: 'New listing' },
  titleWanted: {
    id: 'wachuneed.new.title_wanted',
    defaultMessage: 'Wanted ad',
  },
  labelBudget: {
    id: 'wachuneed.new.field.budget',
    defaultMessage: 'Budget (in AUD)',
  },
  labelTitle: { id: 'wachuneed.new.field.title', defaultMessage: 'Title' },
  labelDescription: {
    id: 'wachuneed.new.field.description',
    defaultMessage: 'Description',
  },
  labelPrice: {
    id: 'wachuneed.new.field.price',
    defaultMessage: 'Price (in AUD)',
  },
  submit: { id: 'wachuneed.new.submit', defaultMessage: 'Publish listing' },
  submitting: {
    id: 'wachuneed.new.submitting',
    defaultMessage: 'Publishing…',
  },
  errorGeneric: {
    id: 'wachuneed.new.error',
    defaultMessage: "Couldn't publish the listing. Try again?",
  },
  editTitle: { id: 'wachuneed.edit.title', defaultMessage: 'Edit listing' },
  editLoading: {
    id: 'wachuneed.edit.loading',
    defaultMessage: 'Loading listing…',
  },
  editLoadError: {
    id: 'wachuneed.edit.load_error',
    defaultMessage: "Couldn't load this listing.",
  },
  save: { id: 'wachuneed.edit.save', defaultMessage: 'Save changes' },
  takeDown: {
    id: 'wachuneed.edit.take_down',
    defaultMessage: 'Take down listing',
  },
  takeDownTitle: {
    id: 'wachuneed.edit.take_down_title',
    defaultMessage: 'Take {name} down?',
  },
  takeDownAsk: {
    id: 'wachuneed.edit.take_down_ask',
    defaultMessage:
      'Sold, or no longer on offer? Taking it down removes it from Wachuneed and from the feed. It stays in Mine, marked closed, and cannot be put back up.',
  },
  takeDownConfirm: {
    id: 'wachuneed.edit.take_down_confirm',
    defaultMessage: 'Take it down',
  },
  takeDownCancel: {
    id: 'wachuneed.edit.take_down_cancel',
    defaultMessage: 'Keep it up',
  },
  takeDownError: {
    id: 'wachuneed.edit.take_down_error',
    defaultMessage: "Couldn't take it down. Try again?",
  },
  saving: { id: 'wachuneed.edit.saving', defaultMessage: 'Saving…' },
  saveError: {
    id: 'wachuneed.edit.error',
    defaultMessage: "Couldn't save your changes. Try again?",
  },
});

// What a listing draft keeps (docs/design.md, Drafts): the four fields and
// who can see it. The photos go as upload ids alongside.
interface ListingDraftParams {
  title?: string;
  description?: string;
  price?: string;
  visibility?: ListingVisibility;
  krewIds?: string[];
}

interface ListingComposerProps {
  // The listing being changed. Absent for a new one.
  editId?: string;
  // Where a new one opens: `?kind=wanted` from Desired.
  initialKind: Kind;
  onCancel: () => void;
  // Saved: where to go next (the listing, or your listings).
  onDone: (path: string) => void;
}

export const ListingComposer: React.FC<ListingComposerProps> = ({
  editId,
  initialKind,
  onCancel,
  onDone,
}) => {
  const intl = useIntl();
  const editing = !!editId;
  const [confirmDialog, confirm] = useConfirmDialog();

  // Fixed by where it was opened from; an edited listing keeps its own.
  const [kind, setKind] = useState<Kind>(initialKind);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  // Edit only: the choices a listing that comes in kinds already has. It
  // has a price per kind, so there is no single price to edit, and its
  // photos keep the choice each one shows.
  const [kindChoices, setKindChoices] = useState<string[]>([]);
  // Who can see it, and so who can message you about it
  // (docs/spaces/wachuneed.md, Who can see it). A new listing starts on
  // your shop's, else everyone on Kronk.
  const [visibility, setVisibility] = useState<ListingVisibility>('public');
  const shopVisibility = useRef<ListingVisibility>('public');
  // Picked by hand: the shop's answering late doesn't overwrite it.
  const visibilityPicked = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Edit only: the listing's state as loaded (a closed one has nothing left
  // to take down).
  const [loadedState, setLoadedState] = useState<string | null>(null);
  const photoState = useListingPhotos();
  const { load: loadPhotos } = photoState;
  const [loadingListing, setLoadingListing] = useState(editing);
  const [loadError, setLoadError] = useState(false);
  // The Krews it's for, on top of its reach (decisions.md, 2026-10-25).
  const [krewIds, setKrewIds] = useState<string[]>([]);
  const availableKrews = useAvailableKrews();

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    apiGetWachuneedListing(editId)
      .then((listing) => {
        if (cancelled) return;
        const variants = variantStateFrom(listing.variants);
        setTitle(listing.title);
        setKindChoices(hasVariants(variants) ? variantValues(variants) : []);
        setLoadedState(listing.state);
        setKind(listing.kind === 'wanted' ? 'wanted' : 'offer');
        setDescription(listing.description ?? '');
        setPrice(
          typeof listing.price_cents === 'number'
            ? (listing.price_cents / 100).toFixed(2)
            : '',
        );
        setVisibility(listing.visibility ?? 'public');
        setKrewIds(listing.krews?.map((k) => k.id) ?? []);
        loadPhotos(listing.photos ?? []);
        setLoadingListing(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoadingListing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editId, loadPhotos]);

  useEffect(() => {
    if (editId) return;
    let cancelled = false;
    apiGetMyWachuneedShop()
      .then((shop) => {
        if (cancelled) return undefined;
        // A new listing starts from who can see your shop.
        if (shop) shopVisibility.current = shop.visibility;
        if (shop && !visibilityPicked.current) setVisibility(shop.visibility);
        return undefined;
      })
      .catch(() => {
        // No shop: everyone on Kronk.
      });
    return () => {
      cancelled = true;
    };
  }, [editId]);

  const comesInKinds = kindChoices.length > 0;
  // The photo field shows no per-kind choice here; an edited listing's
  // photos keep theirs.
  const noChoices = useMemo<string[]>(() => [], []);

  const handleVisibility = useCallback((value: ListingVisibility) => {
    setVisibility(value);
    visibilityPicked.current = true;
  }, []);
  const handleToggleKrew = useCallback((id: string) => {
    setKrewIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);
  const applyAudience = useCallback(
    (tier: ListingVisibility, ids: string[] | null) => {
      setVisibility(tier);
      visibilityPicked.current = true;
      if (ids) setKrewIds(ids);
    },
    [],
  );
  // No Konnect row (Tal, 2026-11-08). Opened from a record
  // (`?konnect=`), the new listing is still Konnected to it, and may
  // follow its audience ("Same as", decisions.md 2026-10-25).
  const { konnect, reach } = useSameAs(useKonnect('wachuneed'), {
    enabled: !editing,
    apply: applyAudience,
    onChange: handleVisibility,
    onToggleKrew: handleToggleKrew,
  });
  const commitKonnect = konnect.commit;

  // Drafts: a new listing is kept as you write it, here and on the server,
  // and comes back when the composer opens again. Editing one keeps none.
  const applyDraft = useCallback(
    (d: ApiComposerDraftJSON<ListingDraftParams> | null) => {
      const p = d?.params ?? {};
      setTitle(p.title ?? '');
      setDescription(p.description ?? '');
      setPrice(p.price ?? '');
      setVisibility(p.visibility ?? shopVisibility.current);
      visibilityPicked.current = !!p.visibility;
      setKrewIds(p.krewIds ?? []);
      loadPhotos(
        (d?.media_attachments ?? []).map((m) => ({
          id: m.id,
          url: m.preview_url || m.url,
          variant_value: null,
        })),
      );
      setError(null);
    },
    [loadPhotos],
  );

  const draft = useDraft<ListingDraftParams>({
    korner: 'wachuneed',
    // A wanted ad and a listing on offer keep separate drafts.
    kind: initialKind === 'wanted' ? 'wanted_listing' : 'listing',
    context: null,
    snapshot: {
      params: { title, description, price, visibility, krewIds },
      mediaIds: photoState.ids,
    },
    hasContent:
      title.trim() !== '' ||
      description.trim() !== '' ||
      price.trim() !== '' ||
      photoState.ids.length > 0,
    apply: applyDraft,
    describe: (d) => d.params.title,
    active: !editing,
    paused: submitting,
  });
  const finishDraft = draft.finish;

  const handleTitleChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setTitle(e.currentTarget.value);
  }, []);
  const handleDescriptionChange = useCallback<
    React.ChangeEventHandler<HTMLTextAreaElement>
  >((e) => {
    setDescription(e.currentTarget.value);
  }, []);
  const handlePriceChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setPrice(e.currentTarget.value);
  }, []);

  const canSubmit =
    !loadingListing &&
    !loadError &&
    title.trim().length > 0 &&
    !photoState.uploading;

  const errorPublish = intl.formatMessage(
    editId ? messages.saveError : messages.errorGeneric,
  );
  const handleSubmit = useCallback(() => {
    setSubmitting(true);
    setError(null);

    const parsedPrice = price.trim();
    const priceCents = parsedPrice
      ? Math.round(parseFloat(parsedPrice) * 100)
      : null;
    const priceFields =
      priceCents !== null && Number.isFinite(priceCents)
        ? { price_cents: priceCents, price_currency: 'AUD' }
        : { price_cents: null };

    void (async () => {
      try {
        if (editId) {
          // Only what this composer shows. Everything else the listing has
          // (sections, availability, variations, options, booking, its
          // state, whether it is in the feed) is left as it is: the server
          // changes only the keys it is sent.
          await apiUpdateWachuneedListing(editId, {
            title: title.trim(),
            description: description.trim(),
            ...(comesInKinds ? {} : priceFields),
            visibility,
            krew_ids: krewIds,
            ...(photoState.touched
              ? {
                  media_attachment_ids: photoState.ids,
                  photo_variants: photoState.showsPayload(kindChoices),
                }
              : {}),
          });
          onDone(`/hub/wachuneed/listings/${editId}`);
          return;
        }

        const payload: CreateListingParams = {
          title: title.trim(),
          description: description.trim() || undefined,
          // Nothing asks for a category (decisions.md, 2026-11-08).
          category: 'goods',
          kind,
          state: 'live',
          ...priceFields,
          ...(photoState.ids.length > 0
            ? { media_attachment_ids: photoState.ids }
            : {}),
          visibility,
          krew_ids: krewIds,
        };
        const listing = await apiCreateWachuneedListing(payload);
        finishDraft();
        await commitKonnect('wachuneed', listing.id);
        // Land where it now shows: your listings.
        onDone('/hub/wachuneed/mine');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : errorPublish);
        setSubmitting(false);
      }
    })();
  }, [
    editId,
    photoState,
    title,
    description,
    kind,
    price,
    comesInKinds,
    kindChoices,
    visibility,
    krewIds,
    finishDraft,
    commitKonnect,
    onDone,
    errorPublish,
  ]);

  const takeDownError = intl.formatMessage(messages.takeDownError);
  const handleTakeDown = useCallback(() => {
    if (!editId) return;
    void (async () => {
      const ok = await confirm({
        title: intl.formatMessage(messages.takeDownTitle, {
          name: title.trim(),
        }),
        message: intl.formatMessage(messages.takeDownAsk),
        confirmLabel: intl.formatMessage(messages.takeDownConfirm),
        cancelLabel: intl.formatMessage(messages.takeDownCancel),
        destructive: true,
      });
      if (!ok) return;

      setSubmitting(true);
      setError(null);
      try {
        await apiCloseWachuneedListing(editId);
        // Your shelf, where it now shows as closed.
        onDone('/hub/wachuneed/mine');
      } catch {
        setError(takeDownError);
        setSubmitting(false);
      }
    })();
  }, [confirm, editId, intl, onDone, takeDownError, title]);

  return (
    <ComposeShell
      korner='wachuneed'
      label={intl.formatMessage(
        editing
          ? messages.editTitle
          : kind === 'wanted'
            ? messages.titleWanted
            : messages.title,
      )}
      submitLabel={intl.formatMessage(
        editing ? messages.save : messages.submit,
      )}
      submittingLabel={intl.formatMessage(
        editing ? messages.saving : messages.submitting,
      )}
      submitting={submitting}
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      draft={editing ? undefined : draft}
      konnect={null}
      headerAction={
        <ReachDropdown
          value={visibility}
          onChange={reach.onChange}
          disabled={submitting || loadingListing}
          krews={availableKrews}
          selectedKrewIds={krewIds}
          onToggleKrew={reach.onToggleKrew}
          sameAs={reach.sameAs}
          onSameAs={reach.onSameAs}
        />
      }
    >
      {confirmDialog}

      {loadingListing && (
        <LoadingState label={intl.formatMessage(messages.editLoading)} />
      )}
      {loadError && (
        <ComposeHint error>
          <FormattedMessage {...messages.editLoadError} />
        </ComposeHint>
      )}

      {!loadingListing && !loadError && (
        <>
          <ListingPhotoField state={photoState} showsChoices={noChoices} />

          <ComposeTitle
            value={title}
            onChange={handleTitleChange}
            aria-label={intl.formatMessage(messages.labelTitle)}
            placeholder={intl.formatMessage(messages.labelTitle)}
            required
            maxLength={200}
          />

          <ComposeBody
            value={description}
            onChange={handleDescriptionChange}
            aria-label={intl.formatMessage(messages.labelDescription)}
            placeholder={intl.formatMessage(messages.labelDescription)}
          />

          {!comesInKinds && (
            <ComposeRow>
              <ComposeField
                label={
                  <FormattedMessage
                    {...(kind === 'wanted'
                      ? messages.labelBudget
                      : messages.labelPrice)}
                  />
                }
              >
                <ComposeInput
                  type='number'
                  min={0}
                  step={0.01}
                  value={price}
                  onChange={handlePriceChange}
                />
              </ComposeField>
            </ComposeRow>
          )}

          {error && <ComposeHint error>{error}</ComposeHint>}

          {editing && loadedState !== null && loadedState !== 'closed' && (
            <button
              type='button'
              className='compose-shell__delete'
              onClick={handleTakeDown}
              disabled={submitting}
            >
              <FormattedMessage {...messages.takeDown} />
            </button>
          )}
        </>
      )}
    </ComposeShell>
  );
};

// The routes: the composer over what it belongs to, Wachuneed's home for a
// new listing and the listing's own page when changing one.
const WachuneedNew: React.FC<{ multiColumn?: boolean }> = () => {
  const history = useHistory();
  const { id } = useParams<{ id?: string }>();
  // The listing it opened on. The page underneath swaps a number in the
  // address for the listing name (useNamedLink), which must not reload
  // the composer over what is being typed.
  const [editId] = useState(id);
  const { search } = useLocation();
  const returnToSource = useKonnectReturn();
  const initialKind: Kind =
    new URLSearchParams(search).get('kind') === 'wanted' ? 'wanted' : 'offer';

  const handleCancel = useCallback(() => {
    if (editId) {
      history.replace(`/hub/wachuneed/listings/${editId}`);
      return;
    }
    // Opened from a record (`?konnect=`): back to it.
    if (returnToSource('/hub/wachuneed')) return;
    history.replace(
      initialKind === 'wanted' ? '/hub/wachuneed/desired' : '/hub/wachuneed',
    );
  }, [editId, history, initialKind, returnToSource]);

  const handleDone = useCallback(
    (path: string) => {
      history.push(path);
    },
    [history],
  );

  return (
    <>
      {editId ? <ListingDetail /> : <Wachuneed />}
      <ListingComposer
        key={editId ?? `new-${initialKind}`}
        editId={editId}
        initialKind={initialKind}
        onCancel={handleCancel}
        onDone={handleDone}
      />
    </>
  );
};

// eslint-disable-next-line import/no-default-export
export default WachuneedNew;
