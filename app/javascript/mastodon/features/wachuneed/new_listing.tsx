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
import type { ApiShopSectionJSON } from 'mastodon/api/wachuneed_shops';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import type {
  ListingAvailability,
  ListingVisibility,
} from 'mastodon/api_types/wachuneed';
import {
  ComposeBody,
  ComposeCheck,
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeRow,
  ComposeSelect,
  ComposeTitle,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import { useAvailableKrews } from 'mastodon/hooks/useAvailableKrews';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';
import { useDraft } from 'mastodon/hooks/useDraft';
import type { KonnectTarget } from 'mastodon/hooks/useKonnect';
import { useKonnect } from 'mastodon/hooks/useKonnect';
import { useKonnectReturn } from 'mastodon/hooks/useKonnectReturn';
import { useSameAs } from 'mastodon/hooks/useSameAs';

import Wachuneed from './index';
import {
  EMPTY_BOOKING,
  ListingBookingEditor,
  bookingStateFrom,
  bookingStateToPayload,
} from './listing_booking_editor';
import type { BookingState } from './listing_booking_editor';
import ListingDetail from './listing_detail';
import {
  ListingOptionsEditor,
  optionRowsFrom,
  optionRowsToPayload,
} from './listing_options_editor';
import type { OptionRow } from './listing_options_editor';
import { ListingPhotoField, useListingPhotos } from './listing_photo_field';
import {
  EMPTY_VARIANTS,
  ListingVariantsEditor,
  hasVariants,
  variantStateFrom,
  variantStateToPayload,
  variantValues,
} from './listing_variants_editor';
import type { VariantState } from './listing_variants_editor';

// The listing composer (docs/spaces/wachuneed.md, Listing): a new listing,
// on offer or wanted (Desired), or one of yours to change. It is the
// standard composer overlay (`<ComposeShell>`, decisions.md 2026-08-12),
// like every other composer (Kommons "Market Composer", 2026-11-08):
//
//   /hub/wachuneed/new                → a new listing over Wachuneed's home;
//                                       `?kind=wanted` opens on wanted,
//                                       `?konnect=` Konnects it to a record
//   /hub/wachuneed/listings/:id/edit  → the same composer, prefilled, over
//                                       the listing's page (the server
//                                       refuses anyone but its poster)
//
// Offering or looking for is the shell's switcher; who can see it, and so
// who can message you about it, is the reach control in the header. Where
// it is: Konnect → Map, a Place (decisions.md 2026-10-23). How people book
// it: listing_booking_editor.tsx. A new listing is saved as a draft as you
// go (docs/design.md, Drafts) and lands in the browse view as soon as it
// is published.

type Category = 'creation' | 'goods' | 'service';

type Kind = 'offer' | 'wanted';

const messages = defineMessages({
  title: { id: 'wachuneed.new.title', defaultMessage: 'New listing' },
  intro: {
    id: 'wachuneed.new.intro',
    defaultMessage:
      'Share something you make, something you have, or something you offer. Kronkers can find it in the browse view and message you to arrange the exchange.',
  },
  introWanted: {
    id: 'wachuneed.new.intro_wanted',
    defaultMessage:
      "Say what you're looking for. It shows in Desired, and anyone who has it can message you.",
  },
  ongoing: {
    id: 'wachuneed.new.ongoing',
    defaultMessage: 'I keep selling this (not a one-off)',
  },
  announce: {
    id: 'wachuneed.new.announce',
    defaultMessage: 'Announce it in the feed',
  },
  announceHint: {
    id: 'wachuneed.new.announce_hint',
    defaultMessage:
      'Shop items are added quietly. Tick this to post a card to the feed.',
  },
  labelAvailability: {
    id: 'wachuneed.new.field.availability',
    defaultMessage: 'Availability',
  },
  available: {
    id: 'wachuneed.availability.available',
    defaultMessage: 'Available',
  },
  soldOut: {
    id: 'wachuneed.availability.sold_out',
    defaultMessage: 'Sold out',
  },
  madeToOrder: {
    id: 'wachuneed.availability.made_to_order',
    defaultMessage: 'Made to order',
  },
  priceFromKinds: {
    id: 'wachuneed.new.price_from_kinds',
    defaultMessage: 'Each kind has its own price, set under Variations.',
  },
  labelSection: {
    id: 'wachuneed.new.field.section',
    defaultMessage: 'Section of your shop',
  },
  sectionNone: {
    id: 'wachuneed.new.section.none',
    defaultMessage: 'No section',
  },
  kindOffer: {
    id: 'wachuneed.new.kind.offer',
    defaultMessage: "Something I'm offering",
  },
  kindWanted: {
    id: 'wachuneed.new.kind.wanted',
    defaultMessage: "Something I'm looking for",
  },
  labelBudget: {
    id: 'wachuneed.new.field.budget',
    defaultMessage: 'Budget (in AUD)',
  },
  placeholderBudget: {
    id: 'wachuneed.new.field.budget_placeholder',
    defaultMessage: 'Optional — what you could pay',
  },
  labelTitle: { id: 'wachuneed.new.field.title', defaultMessage: 'Title' },
  placeholderTitle: {
    id: 'wachuneed.new.field.title_placeholder',
    defaultMessage: 'A short name — what is it?',
  },
  labelDescription: {
    id: 'wachuneed.new.field.description',
    defaultMessage: 'Description',
  },
  placeholderDescription: {
    id: 'wachuneed.new.field.description_placeholder',
    defaultMessage:
      'Detail — materials, size, timing, anything a buyer needs to know.',
  },
  labelCategory: {
    id: 'wachuneed.new.field.category',
    defaultMessage: 'Category',
  },
  categoryArt: {
    id: 'wachuneed.new.category.art',
    defaultMessage: 'Art — things you make',
  },
  categoryStuff: {
    id: 'wachuneed.new.category.stuff',
    defaultMessage: 'Stuff — things you have',
  },
  categoryOfferings: {
    id: 'wachuneed.new.category.offerings',
    defaultMessage: 'Offerings — services you provide',
  },
  labelPrice: {
    id: 'wachuneed.new.field.price',
    defaultMessage: 'Price (in AUD)',
  },
  placeholderPrice: {
    id: 'wachuneed.new.field.price_placeholder',
    defaultMessage: 'Leave blank if free or by arrangement',
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

const KIND_OPTIONS: { key: Kind; label: typeof messages.kindOffer }[] = [
  { key: 'offer', label: messages.kindOffer },
  { key: 'wanted', label: messages.kindWanted },
];

const CATEGORY_OPTIONS: {
  key: Category;
  label: typeof messages.categoryArt;
}[] = [
  { key: 'creation', label: messages.categoryArt },
  { key: 'goods', label: messages.categoryStuff },
  { key: 'service', label: messages.categoryOfferings },
];

const isCategory = (value: string): value is Category =>
  value === 'creation' || value === 'goods' || value === 'service';

// What a listing draft keeps (docs/design.md, Drafts). The photos go as
// upload ids alongside, and which choice each shows by the same ids.
interface ListingDraftParams {
  kind?: Kind;
  title?: string;
  description?: string;
  category?: Category;
  price?: string;
  sectionId?: string;
  ongoing?: boolean;
  availability?: ListingAvailability;
  visibility?: ListingVisibility;
  krewIds?: string[];
  variantState?: VariantState;
  optionRows?: OptionRow[];
  booking?: BookingState;
  photoShows?: Record<string, string>;
  konnections?: KonnectTarget[];
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

  const [kind, setKind] = useState<Kind>(initialKind);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('creation');
  const [price, setPrice] = useState('');
  // Your shop's sections, if you have a shop with any; and the one this
  // listing sits in ('' for none).
  const [shopSections, setShopSections] = useState<ApiShopSectionJSON[]>([]);
  const [sectionId, setSectionId] = useState('');
  // What a buyer can choose (docs/spaces/wachuneed.md, Options).
  const [optionRows, setOptionRows] = useState<OptionRow[]>([]);
  // How it is booked, if it is (docs/spaces/wachuneed.md, Booking).
  const [booking, setBooking] = useState<BookingState>(EMPTY_BOOKING);

  const [variantState, setVariantState] =
    useState<VariantState>(EMPTY_VARIANTS);
  const [ongoing, setOngoing] = useState(false);
  const [announced, setAnnounced] = useState(true);
  // Whether it had already been posted when loaded: that cannot be undone.
  const [wasAnnounced, setWasAnnounced] = useState(false);
  const [availability, setAvailability] =
    useState<ListingAvailability>('available');
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
        setTitle(listing.title);
        setVariantState(variantStateFrom(listing.variants));
        setOngoing(!!listing.ongoing);
        setAvailability(listing.availability ?? 'available');
        setLoadedState(listing.state);
        setAnnounced(listing.announced !== false);
        setWasAnnounced(listing.announced !== false);
        setKind(listing.kind === 'wanted' ? 'wanted' : 'offer');
        setDescription(listing.description ?? '');
        if (isCategory(listing.category)) setCategory(listing.category);
        setPrice(
          typeof listing.price_cents === 'number'
            ? (listing.price_cents / 100).toFixed(2)
            : '',
        );
        setSectionId(listing.shop_section_id ?? '');
        setVisibility(listing.visibility ?? 'public');
        setKrewIds(listing.krews?.map((k) => k.id) ?? []);
        setOptionRows(optionRowsFrom(listing.options));
        setBooking(bookingStateFrom(listing.booking));
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
    let cancelled = false;
    apiGetMyWachuneedShop()
      .then((shop) => {
        if (cancelled) return undefined;
        setShopSections(shop?.sections ?? []);
        // A new listing starts from who can see your shop.
        if (shop) shopVisibility.current = shop.visibility;
        if (!editId && shop && !visibilityPicked.current)
          setVisibility(shop.visibility);
        return undefined;
      })
      .catch(() => {
        // No section to choose; the listing saves without one.
      });
    return () => {
      cancelled = true;
    };
  }, [editId]);

  // Only something on offer goes in a shop.
  const showSections = kind === 'offer' && shopSections.length > 0;

  const comesInKinds = kind === 'offer' && hasVariants(variantState);
  const showsChoices = useMemo(
    () => (comesInKinds ? variantValues(variantState) : []),
    [comesInKinds, variantState],
  );

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
  // What a new listing will be Konnected to (decisions.md, 2026-10-23),
  // and whose audience it may follow ("Same as", 2026-10-25).
  const { konnect, reach } = useSameAs(useKonnect('wachuneed'), {
    enabled: !editing,
    apply: applyAudience,
    onChange: handleVisibility,
    onToggleKrew: handleToggleKrew,
  });
  const commitKonnect = konnect.commit;
  const restoreKonnect = konnect.restore;

  // Drafts: a new listing is kept as you write it, here and on the server,
  // and comes back when the composer opens again. Editing one keeps none.
  const applyDraft = useCallback(
    (d: ApiComposerDraftJSON<ListingDraftParams> | null) => {
      const p = d?.params ?? {};
      setKind(p.kind ?? initialKind);
      setTitle(p.title ?? '');
      setDescription(p.description ?? '');
      setCategory(p.category ?? 'creation');
      setPrice(p.price ?? '');
      setSectionId(p.sectionId ?? '');
      setOngoing(p.ongoing ?? false);
      setAvailability(p.availability ?? 'available');
      setVisibility(p.visibility ?? shopVisibility.current);
      visibilityPicked.current = !!p.visibility;
      setKrewIds(p.krewIds ?? []);
      setVariantState(p.variantState ?? EMPTY_VARIANTS);
      setOptionRows(p.optionRows ?? []);
      setBooking(p.booking ?? EMPTY_BOOKING);
      restoreKonnect(p.konnections);
      const shows = p.photoShows ?? {};
      loadPhotos(
        (d?.media_attachments ?? []).map((m) => ({
          id: m.id,
          url: m.preview_url || m.url,
          variant_value: shows[m.id] ?? null,
        })),
      );
      setError(null);
    },
    [initialKind, loadPhotos, restoreKonnect],
  );

  const draft = useDraft<ListingDraftParams>({
    korner: 'wachuneed',
    kind: 'listing',
    context: null,
    snapshot: {
      params: {
        kind,
        title,
        description,
        category,
        price,
        sectionId,
        ongoing,
        availability,
        visibility,
        krewIds,
        variantState,
        optionRows,
        booking,
        photoShows: photoState.showsPayload(showsChoices),
        konnections: konnect.saved,
      },
      mediaIds: photoState.ids,
    },
    hasContent:
      title.trim() !== '' ||
      description.trim() !== '' ||
      price.trim() !== '' ||
      hasVariants(variantState) ||
      optionRows.length > 0 ||
      photoState.ids.length > 0,
    apply: applyDraft,
    describe: (d) => d.params.title,
    active: !editing,
    paused: submitting,
  });
  const finishDraft = draft.finish;

  const toOffer = useCallback(() => {
    setKind('offer');
  }, []);
  const toWanted = useCallback(() => {
    setKind('wanted');
  }, []);

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
  const handleCategoryChange = useCallback<
    React.ChangeEventHandler<HTMLSelectElement>
  >((e) => {
    const value = e.currentTarget.value;
    if (isCategory(value)) setCategory(value);
  }, []);
  const handlePriceChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setPrice(e.currentTarget.value);
  }, []);
  const handleSectionChange = useCallback<
    React.ChangeEventHandler<HTMLSelectElement>
  >((e) => {
    setSectionId(e.currentTarget.value);
  }, []);
  const handleOngoing = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setOngoing(e.currentTarget.checked);
    },
    [],
  );
  const handleAnnounced = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setAnnounced(e.currentTarget.checked);
  }, []);
  const handleAvailability = useCallback<
    React.ChangeEventHandler<HTMLSelectElement>
  >((e) => {
    setAvailability(e.currentTarget.value as ListingAvailability);
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

    const photoIds = photoState.ids;

    const payload: CreateListingParams = {
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      kind,
      state: 'live',
      ...(priceCents !== null && Number.isFinite(priceCents)
        ? { price_cents: priceCents, price_currency: 'AUD' }
        : { price_cents: null }),
      ...(photoIds.length > 0 ? { media_attachment_ids: photoIds } : {}),
      ...(shopSections.length > 0
        ? { listing_shop_section_id: showSections ? sectionId || null : null }
        : {}),
      // A wanted ad has nothing to choose.
      options: kind === 'offer' ? optionRowsToPayload(optionRows) : [],
      variants: kind === 'offer' ? variantStateToPayload(variantState) : {},
      booking: kind === 'offer' ? bookingStateToPayload(booking) : {},
      ongoing: kind === 'offer' && ongoing,
      availability,
      announced,
      visibility,
      krew_ids: krewIds,
      photo_variants: photoState.showsPayload(showsChoices),
    };

    void (async () => {
      try {
        if (editId) {
          // Keep the listing's state; send the photos only if they changed.
          const edit: Partial<CreateListingParams> = { ...payload };
          delete edit.state;
          delete edit.media_attachment_ids;
          await apiUpdateWachuneedListing(editId, {
            ...edit,
            ...(photoState.touched
              ? { media_attachment_ids: photoState.ids }
              : {}),
          });
          onDone(`/hub/wachuneed/listings/${editId}`);
          return;
        }
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
    category,
    kind,
    price,
    shopSections,
    showSections,
    sectionId,
    optionRows,
    booking,
    variantState,
    ongoing,
    availability,
    announced,
    visibility,
    krewIds,
    showsChoices,
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

  // Offering or looking for: the shell's switcher, for a new listing. A
  // listing already up keeps its kind.
  const switcher = editing ? undefined : (
    <>
      {KIND_OPTIONS.map((opt) => (
        <KornerPill
          key={opt.key}
          label={intl.formatMessage(opt.label)}
          active={kind === opt.key}
          onClick={opt.key === 'offer' ? toOffer : toWanted}
        />
      ))}
    </>
  );

  return (
    <ComposeShell
      korner='wachuneed'
      label={intl.formatMessage(editing ? messages.editTitle : messages.title)}
      subtitle={
        editing
          ? undefined
          : intl.formatMessage(
              kind === 'wanted' ? messages.introWanted : messages.intro,
            )
      }
      switcher={switcher}
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
      konnect={editing ? null : konnect}
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
          <ListingPhotoField state={photoState} showsChoices={showsChoices} />

          <ComposeTitle
            value={title}
            onChange={handleTitleChange}
            placeholder={intl.formatMessage(messages.placeholderTitle)}
            aria-label={intl.formatMessage(messages.labelTitle)}
            required
            maxLength={200}
          />

          <ComposeBody
            value={description}
            onChange={handleDescriptionChange}
            placeholder={intl.formatMessage(messages.placeholderDescription)}
            aria-label={intl.formatMessage(messages.labelDescription)}
          />

          <ComposeRow>
            <ComposeField
              label={<FormattedMessage {...messages.labelCategory} />}
            >
              <ComposeSelect value={category} onChange={handleCategoryChange}>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {intl.formatMessage(opt.label)}
                  </option>
                ))}
              </ComposeSelect>
            </ComposeField>

            {showSections && (
              <ComposeField
                label={<FormattedMessage {...messages.labelSection} />}
              >
                <ComposeSelect value={sectionId} onChange={handleSectionChange}>
                  <option value=''>
                    {intl.formatMessage(messages.sectionNone)}
                  </option>
                  {shopSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </ComposeSelect>
              </ComposeField>
            )}
          </ComposeRow>

          {comesInKinds ? (
            <ComposeHint>
              <FormattedMessage {...messages.priceFromKinds} />
            </ComposeHint>
          ) : (
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
                  placeholder={intl.formatMessage(
                    kind === 'wanted'
                      ? messages.placeholderBudget
                      : messages.placeholderPrice,
                  )}
                />
              </ComposeField>

              {kind === 'offer' && (
                <ComposeField
                  label={<FormattedMessage {...messages.labelAvailability} />}
                >
                  <ComposeSelect
                    value={availability}
                    onChange={handleAvailability}
                  >
                    <option value='available'>
                      {intl.formatMessage(messages.available)}
                    </option>
                    <option value='sold_out'>
                      {intl.formatMessage(messages.soldOut)}
                    </option>
                    <option value='made_to_order'>
                      {intl.formatMessage(messages.madeToOrder)}
                    </option>
                  </ComposeSelect>
                </ComposeField>
              )}
            </ComposeRow>
          )}

          {kind === 'offer' && (
            <ComposeCheck
              label={<FormattedMessage {...messages.ongoing} />}
              checked={ongoing}
              onChange={handleOngoing}
            />
          )}

          {kind === 'offer' && (
            <ListingVariantsEditor
              state={variantState}
              onChange={setVariantState}
            />
          )}

          {kind === 'offer' && (
            <ListingOptionsEditor
              category={category}
              rows={optionRows}
              onChange={setOptionRows}
            />
          )}

          {kind === 'offer' && (
            <ListingBookingEditor state={booking} onChange={setBooking} />
          )}

          {/* Only where there is a choice to make: a shop item not yet in
              the feed. An ordinary listing is always posted. */}
          {editing && kind === 'offer' && !wasAnnounced && (
            <ComposeCheck
              label={<FormattedMessage {...messages.announce} />}
              hint={<FormattedMessage {...messages.announceHint} />}
              checked={announced}
              onChange={handleAnnounced}
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
