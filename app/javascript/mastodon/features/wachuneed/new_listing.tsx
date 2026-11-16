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
import type {
  ListingVisibility,
  ListingOffering,
  ListingLookingFor,
  ListingPriceType,
  ListingPriceUnit,
  ListingWhereMode,
} from 'mastodon/api_types/wachuneed';
import {
  ComposeBody,
  ComposeHint,
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
  ListingPriceField,
  isPriceType,
  isPriceUnit,
  priceHasAmount,
} from './listing_price_field';
import {
  hasVariants,
  variantStateFrom,
  variantValues,
} from './listing_variants_editor';
import { offeringMessages, isOffering } from './offering';
import { OfferingChooser } from './offering_chooser';
import { OfferingComposer } from './offering_composer';
import {
  MAX_SPOTS,
  WantedChooser,
  isLookingFor,
  isWhereMode,
  wantedMessages,
} from './wanted';
import { WantedDetailsField } from './wanted_details_field';

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
// It asks for photos, name, description and price (what kind of price,
// and the amount and what it is for when it has one: what the poster
// pays, when wanted), and nothing else (Tal, 2026-11-08: "keep things basic and simple"). Who
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
  labelTitle: { id: 'wachuneed.new.field.title', defaultMessage: 'Title' },
  labelDescription: {
    id: 'wachuneed.new.field.description',
    defaultMessage: 'Description',
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
  priceType?: ListingPriceType;
  priceUnit?: ListingPriceUnit | null;
  whereMode?: ListingWhereMode;
  area?: string;
  dueOn?: string;
  spots?: string;
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
  // Offering something other than a thing to buy (a new offer only): back
  // to What are you offering? (Tal, 2026-11-09).
  onChangeOffering?: () => void;
  // A new wanted ad: what it is after, picked first (wanted.tsx), and the
  // way back to that choice.
  lookingFor?: ListingLookingFor;
  onChangeLookingFor?: () => void;
}

export const ListingComposer: React.FC<ListingComposerProps> = ({
  editId,
  initialKind,
  onCancel,
  onDone,
  onChangeOffering,
  lookingFor: initialLookingFor,
  onChangeLookingFor,
}) => {
  const intl = useIntl();
  const editing = !!editId;
  const [confirmDialog, confirm] = useConfirmDialog();

  // Fixed by where it was opened from; an edited listing keeps its own.
  const [kind, setKind] = useState<Kind>(initialKind);
  // A wanted ad's details (docs/spaces/wachuneed.md, Wanted ads). Older
  // wanted ads have none and read as a thing.
  const [lookingFor, setLookingFor] = useState<ListingLookingFor | null>(
    initialLookingFor ?? null,
  );
  const [whereMode, setWhereMode] = useState<ListingWhereMode>('online');
  const [area, setArea] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [spots, setSpots] = useState('1');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [priceType, setPriceType] = useState<ListingPriceType>('fixed');
  const [priceUnit, setPriceUnit] = useState<ListingPriceUnit | null>(null);
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
        setPriceType(listing.price_type ?? 'fixed');
        setLookingFor(listing.looking_for ?? null);
        setWhereMode(listing.where_mode ?? 'online');
        setArea(listing.location ?? '');
        setDueOn(listing.due_on ?? '');
        setSpots(String(listing.spots ?? 1));
        setPriceUnit(listing.price_unit ?? null);
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
      setPriceType(isPriceType(p.priceType) ? p.priceType : 'fixed');
      setPriceUnit(isPriceUnit(p.priceUnit) ? p.priceUnit : null);
      setWhereMode(isWhereMode(p.whereMode) ? p.whereMode : 'online');
      setArea(p.area ?? '');
      setDueOn(p.dueOn ?? '');
      setSpots(p.spots ?? '1');
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
      params: {
        title,
        description,
        price,
        priceType,
        priceUnit,
        whereMode,
        area,
        dueOn,
        spots,
        visibility,
        krewIds,
      },
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

    // An amount only for a price that has one (docs/spaces/wachuneed.md,
    // Prices); the server drops it from any other.
    const parsedPrice = priceHasAmount(priceType) ? price.trim() : '';
    const priceCents = parsedPrice
      ? Math.round(parseFloat(parsedPrice) * 100)
      : null;
    const priceFields = {
      price_type: priceType,
      price_unit: priceHasAmount(priceType) ? priceUnit : null,
      ...(priceCents !== null && Number.isFinite(priceCents)
        ? { price_cents: priceCents, price_currency: 'AUD' }
        : { price_cents: null }),
    };

    // What a wanted ad is after, and for anything but a thing, where, by
    // when and how many people (docs/spaces/wachuneed.md, Wanted ads).
    const wantedFields =
      kind === 'wanted' && lookingFor
        ? {
            looking_for: lookingFor,
            ...(lookingFor === 'thing'
              ? {}
              : {
                  where_mode: whereMode,
                  location: whereMode === 'online' ? '' : area.trim(),
                  due_on: dueOn || null,
                  spots: Math.min(
                    MAX_SPOTS,
                    Math.max(1, parseInt(spots, 10) || 1),
                  ),
                }),
          }
        : {};

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
            ...wantedFields,
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
          ...wantedFields,
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
    priceType,
    priceUnit,
    lookingFor,
    whereMode,
    area,
    dueOn,
    spots,
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
      subtitle={
        onChangeOffering ? (
          <button
            type='button'
            className='wachuneed-offering-change'
            onClick={onChangeOffering}
          >
            {intl.formatMessage(offeringMessages.change)}
          </button>
        ) : onChangeLookingFor ? (
          <button
            type='button'
            className='wachuneed-offering-change'
            onClick={onChangeLookingFor}
          >
            {intl.formatMessage(wantedMessages.change)}
          </button>
        ) : undefined
      }
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
            <ListingPriceField
              wanted={kind === 'wanted'}
              type={priceType}
              amount={price}
              unit={priceUnit}
              onType={setPriceType}
              onAmount={setPrice}
              onUnit={setPriceUnit}
            />
          )}

          {kind === 'wanted' && lookingFor && lookingFor !== 'thing' && (
            <WantedDetailsField
              lookingFor={lookingFor}
              whereMode={whereMode}
              area={area}
              dueOn={dueOn}
              spots={spots}
              onWhereMode={setWhereMode}
              onArea={setArea}
              onDueOn={setDueOn}
              onSpots={setSpots}
            />
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
  const intl = useIntl();
  const history = useHistory();
  const { id } = useParams<{ id?: string }>();
  // The listing it opened on. The page underneath swaps a number in the
  // address for the listing name (useNamedLink), which must not reload
  // the composer over what is being typed.
  const [editId] = useState(id);
  const { search, pathname } = useLocation();
  const returnToSource = useKonnectReturn();
  const query = new URLSearchParams(search);
  const initialKind: Kind = query.get('kind') === 'wanted' ? 'wanted' : 'offer';
  // What it offers (docs/spaces/wachuneed.md, What are you offering?): a
  // new one says so in the address (`?offering=`) and opens on the picker
  // until it does (Tal, 2026-11-09); one being changed says it itself. A
  // new wanted ad is asked what it is looking for instead (`?looking=`,
  // 2026-11-16), and opens on that picker until it says.
  const asked = query.get('offering');
  const looking = query.get('looking');
  const lookingFor = isLookingFor(looking) ? looking : null;
  const [editOffering, setEditOffering] = useState<ListingOffering | null>(
    null,
  );
  useEffect(() => {
    if (!editId) return;
    void apiGetWachuneedListing(editId)
      .then((listing) => {
        setEditOffering(
          isOffering(listing.offering) ? listing.offering : 'product',
        );
        return undefined;
      })
      .catch(() => {
        setEditOffering('product');
      });
  }, [editId]);
  const offering: ListingOffering | 'choose' | null = editId
    ? editOffering
    : isOffering(asked)
      ? asked
      : initialKind === 'wanted'
        ? 'product'
        : 'choose';

  const handleCancel = useCallback(() => {
    if (editId) {
      history.replace(`/hub/wachuneed/listings/${editId}`);
      return;
    }
    // Opened from a record (`?konnect=`): back to it.
    if (returnToSource('/hub/wachuneed')) return;
    history.replace({
      pathname: '/hub/wachuneed',
      search: initialKind === 'wanted' ? '?show=wanted' : '',
    });
  }, [editId, history, initialKind, returnToSource]);

  const handleDone = useCallback(
    (path: string) => {
      history.push(path);
    },
    [history],
  );

  // Picking what it offers swaps the composer in place, keeping anything
  // else in the address (`?konnect=`).
  const goOffering = useCallback(
    (next: ListingOffering | 'choose') => {
      const params = new URLSearchParams(search);
      if (next === 'choose') params.delete('offering');
      else params.set('offering', next);
      history.replace({ pathname, search: `?${params.toString()}` });
    },
    [history, pathname, search],
  );
  const handleChoose = useCallback(() => {
    goOffering('choose');
  }, [goOffering]);
  const goLooking = useCallback(
    (next: ListingLookingFor | null) => {
      const params = new URLSearchParams(search);
      if (next) params.set('looking', next);
      else params.delete('looking');
      history.replace({ pathname, search: `?${params.toString()}` });
    },
    [history, pathname, search],
  );
  const handleChooseLooking = useCallback(() => {
    goLooking(null);
  }, [goLooking]);
  const handleSaved = useCallback(
    (savedId: string | null) => {
      history.push(
        savedId ? `/hub/wachuneed/listings/${savedId}` : '/hub/wachuneed/mine',
      );
    },
    [history],
  );

  const page = editId ? <ListingDetail /> : <Wachuneed />;
  if (offering === null) return page;

  if (!editId && initialKind === 'wanted' && !lookingFor) {
    return (
      <>
        {page}
        <WantedChooser
          label={intl.formatMessage(messages.titleWanted)}
          onPick={goLooking}
          onCancel={handleCancel}
        />
      </>
    );
  }

  if (offering === 'choose') {
    return (
      <>
        {page}
        <OfferingChooser
          label={intl.formatMessage(offeringMessages.question)}
          onPick={goOffering}
          onCancel={handleCancel}
        />
      </>
    );
  }

  if (offering !== 'product' && initialKind === 'offer') {
    return (
      <>
        {page}
        <OfferingComposer
          key={editId ?? `new-${offering}`}
          offering={offering}
          inShop={false}
          editId={editId}
          onChangeOffering={handleChoose}
          onCancel={handleCancel}
          onSaved={handleSaved}
        />
      </>
    );
  }

  return (
    <>
      {page}
      <ListingComposer
        key={editId ?? `new-${initialKind}-${lookingFor ?? ''}`}
        editId={editId}
        initialKind={initialKind}
        onCancel={handleCancel}
        onDone={handleDone}
        onChangeOffering={
          !editId && initialKind === 'offer' ? handleChoose : undefined
        }
        lookingFor={editId ? undefined : (lookingFor ?? undefined)}
        onChangeLookingFor={
          !editId && initialKind === 'wanted' ? handleChooseLooking : undefined
        }
      />
    </>
  );
};

// eslint-disable-next-line import/no-default-export
export default WachuneedNew;
