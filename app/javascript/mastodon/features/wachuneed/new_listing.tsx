import { useCallback, useEffect, useMemo, useState } from 'react';

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
import type {
  ListingAvailability,
  ListingEnquiries,
} from 'mastodon/api_types/wachuneed';
import { Stage } from 'mastodon/components/stage';

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

// /hub/wachuneed/new — the composer for a new listing, on offer or
// wanted (Desired); `?kind=wanted` opens on wanted.
// /hub/wachuneed/listings/:id/edit — the same form, prefilled, for the
// listing's owner (the server refuses anyone else).
//
// Kept intentionally simple in this pass: title + description +
// category picker + optional price + optional location + photos. The
// 5 interaction modes (buy_now, buy_or_bargain, book_service,
// contact_to_discuss, workshop_join) are a follow-up — this composer
// only produces a listing in the `live` state so it lands in the
// browse view immediately.

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
  labelKind: {
    id: 'wachuneed.new.field.kind',
    defaultMessage: 'What are you posting?',
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
  labelLocation: {
    id: 'wachuneed.new.field.location',
    defaultMessage: 'Location',
  },
  placeholderLocation: {
    id: 'wachuneed.new.field.location_placeholder',
    defaultMessage: 'City / remote / by post — how does the exchange happen?',
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
  labelEnquiries: {
    id: 'wachuneed.new.field.enquiries',
    defaultMessage: 'Who can message you about this?',
  },
  enquiriesMates: {
    id: 'wachuneed.new.enquiries.mates',
    defaultMessage: 'Mates',
  },
  enquiriesOrbit: {
    id: 'wachuneed.new.enquiries.orbit',
    defaultMessage: 'Orbit',
  },
  enquiriesAnyone: {
    id: 'wachuneed.new.enquiries.anyone',
    defaultMessage: 'Anyone on Kronk',
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

// Who can message you about it, on the reach ladder's words
// (docs/spaces/wachuneed.md, Enquiries).
const ENQUIRY_OPTIONS: {
  key: ListingEnquiries;
  label: typeof messages.enquiriesMates;
}[] = [
  { key: 'mates', label: messages.enquiriesMates },
  { key: 'orbit', label: messages.enquiriesOrbit },
  { key: 'anyone', label: messages.enquiriesAnyone },
];

const WachuneedNew: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const history = useHistory();
  const { id: editId } = useParams<{ id?: string }>();
  const { search } = useLocation();
  const editing = !!editId;

  // `/hub/wachuneed/new?kind=wanted` opens straight on "looking for".
  const [kind, setKind] = useState<Kind>(() =>
    new URLSearchParams(search).get('kind') === 'wanted' ? 'wanted' : 'offer',
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('creation');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  // Your shop's sections, if you have a shop with any; and the one this
  // listing sits in ('' for none).
  const [shopSections, setShopSections] = useState<ApiShopSectionJSON[]>([]);
  const [sectionId, setSectionId] = useState('');
  // What a buyer can choose (docs/spaces/wachuneed.md, Options).
  const [optionRows, setOptionRows] = useState<OptionRow[]>([]);

  const [variantState, setVariantState] =
    useState<VariantState>(EMPTY_VARIANTS);
  const [ongoing, setOngoing] = useState(false);
  const [announced, setAnnounced] = useState(true);
  // Whether it had already been posted when loaded: that cannot be undone.
  const [wasAnnounced, setWasAnnounced] = useState(false);
  const [availability, setAvailability] =
    useState<ListingAvailability>('available');
  // Who can message you about it. Until you pick, the form shows what
  // applies (the listing's, or your shop's, else Mates) and sends nothing,
  // so an untouched listing keeps following the shop.
  const [enquiries, setEnquiries] = useState<ListingEnquiries | null>(null);
  const [enquiriesDefault, setEnquiriesDefault] =
    useState<ListingEnquiries>('mates');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Edit only: the listing's state as loaded (a closed one has nothing left
  // to take down), and the two-step take-down.
  const [loadedState, setLoadedState] = useState<string | null>(null);
  const [askTakeDown, setAskTakeDown] = useState(false);
  const [takingDown, setTakingDown] = useState(false);
  const photoState = useListingPhotos();
  const { load: loadPhotos } = photoState;
  const [loadingListing, setLoadingListing] = useState(editing);
  const [loadError, setLoadError] = useState(false);

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
        if (
          listing.category === 'creation' ||
          listing.category === 'goods' ||
          listing.category === 'service'
        ) {
          setCategory(listing.category);
        }
        setPrice(
          typeof listing.price_cents === 'number'
            ? (listing.price_cents / 100).toFixed(2)
            : '',
        );
        setLocation(listing.location ?? '');
        setSectionId(listing.shop_section_id ?? '');
        setEnquiriesDefault(listing.enquiries ?? 'mates');
        setOptionRows(optionRowsFrom(listing.options));
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
        // A new listing starts from what your shop says.
        if (!editId && shop) setEnquiriesDefault(shop.enquiries);
        return undefined;
      })
      .catch(() => {
        // No section to choose; the listing saves without one.
      });
    return () => {
      cancelled = true;
    };
  }, [editId]);

  const handleSectionChange = useCallback<
    React.ChangeEventHandler<HTMLSelectElement>
  >((e) => {
    setSectionId(e.currentTarget.value);
  }, []);

  // Only something on offer goes in a shop.
  const showSections = kind === 'offer' && shopSections.length > 0;

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
  const comesInKinds = kind === 'offer' && hasVariants(variantState);
  const showsChoices = useMemo(
    () => (comesInKinds ? variantValues(variantState) : []),
    [comesInKinds, variantState],
  );
  const photoUploading = photoState.uploading;

  const handleTakeDownAsk = useCallback(() => {
    setAskTakeDown(true);
  }, []);
  const handleTakeDownCancel = useCallback(() => {
    setAskTakeDown(false);
  }, []);
  const takeDownError = intl.formatMessage(messages.takeDownError);
  const handleTakeDown = useCallback(() => {
    if (!editId) return;
    setTakingDown(true);
    setError(null);
    apiCloseWachuneedListing(editId)
      .then(() => {
        // Your shelf, where it now shows as closed.
        history.push('/hub/wachuneed/mine');
        return undefined;
      })
      .catch(() => {
        setError(takeDownError);
        setTakingDown(false);
      });
  }, [editId, history, takeDownError]);

  const canSubmit = useMemo(
    () => title.trim().length > 0 && !submitting && !photoUploading,
    [title, submitting, photoUploading],
  );

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

  const handleKindChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setKind(e.currentTarget.value as Kind);
  }, []);

  const handleEnquiries = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    const picked = ENQUIRY_OPTIONS.find(
      (opt) => opt.key === e.currentTarget.value,
    );
    if (picked) setEnquiries(picked.key);
  }, []);
  const shownEnquiries = enquiries ?? enquiriesDefault;

  const handleCategoryChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setCategory(e.currentTarget.value as Category);
  }, []);

  const handlePriceChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setPrice(e.currentTarget.value);
  }, []);

  const handleLocationChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setLocation(e.currentTarget.value);
  }, []);

  const handleSubmit = useCallback<React.FormEventHandler<HTMLFormElement>>(
    (e) => {
      e.preventDefault();
      if (!canSubmit) return;
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
        location: location.trim() || undefined,
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
        ongoing: kind === 'offer' && ongoing,
        availability,
        announced,
        ...(enquiries ? { enquiries } : {}),
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
            history.push(`/hub/wachuneed/listings/${editId}`);
            return;
          }
          await apiCreateWachuneedListing(payload);
          // Land where it now shows: your listings.
          history.push('/hub/wachuneed/mine');
        } catch (err: unknown) {
          setError(
            err instanceof Error
              ? err.message
              : intl.formatMessage(
                  editId ? messages.saveError : messages.errorGeneric,
                ),
          );
          setSubmitting(false);
        }
      })();
    },
    [
      editId,
      photoState,
      canSubmit,
      title,
      description,
      category,
      kind,
      price,
      location,
      shopSections,
      showSections,
      sectionId,
      optionRows,
      variantState,
      ongoing,
      availability,
      announced,
      enquiries,
      showsChoices,
      history,
      intl,
    ],
  );

  if (editing && (loadingListing || loadError)) {
    return (
      <Stage label={intl.formatMessage(messages.editTitle)}>
        <div className='scrollable wachuneed wachuneed--compose'>
          <p className='wachuneed__status'>
            {intl.formatMessage(
              loadError ? messages.editLoadError : messages.editLoading,
            )}
          </p>
        </div>
      </Stage>
    );
  }

  return (
    <Stage
      label={intl.formatMessage(editing ? messages.editTitle : messages.title)}
    >
      <div className='scrollable wachuneed wachuneed--compose'>
        {/* Hand-rolled "← Cancel" back link removed 2026-09-03 —
            Frame's SpaceBadge carries the back-to-korner nav.
            Bespoke back links are banned platform-wide; see
            docs/design.md (Aesthetic system) § Navigation. */}

        {!editing && (
          <p className='wachuneed__compose-intro'>
            <FormattedMessage
              {...(kind === 'wanted' ? messages.introWanted : messages.intro)}
            />
          </p>
        )}

        <form className='wachuneed__compose-form' onSubmit={handleSubmit}>
          <fieldset className='wachuneed__compose-field'>
            <legend className='wachuneed__compose-label'>
              <FormattedMessage {...messages.labelKind} />
            </legend>
            <div className='wachuneed__compose-radio-group'>
              {KIND_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className={`wachuneed__compose-radio ${kind === opt.key ? 'wachuneed__compose-radio--active' : ''}`}
                >
                  <input
                    type='radio'
                    name='kind'
                    value={opt.key}
                    checked={kind === opt.key}
                    onChange={handleKindChange}
                  />
                  <span>{intl.formatMessage(opt.label)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className='wachuneed__compose-field'>
            <span className='wachuneed__compose-label'>
              <FormattedMessage {...messages.labelTitle} />
            </span>
            <input
              type='text'
              className='wachuneed__compose-input'
              value={title}
              onChange={handleTitleChange}
              placeholder={intl.formatMessage(messages.placeholderTitle)}
              required
              maxLength={200}
            />
          </label>

          <label className='wachuneed__compose-field'>
            <span className='wachuneed__compose-label'>
              <FormattedMessage {...messages.labelDescription} />
            </span>
            <textarea
              className='wachuneed__compose-textarea'
              value={description}
              onChange={handleDescriptionChange}
              placeholder={intl.formatMessage(messages.placeholderDescription)}
              rows={4}
            />
          </label>

          <fieldset className='wachuneed__compose-field'>
            <legend className='wachuneed__compose-label'>
              <FormattedMessage {...messages.labelCategory} />
            </legend>
            <div className='wachuneed__compose-radio-group'>
              {CATEGORY_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className={`wachuneed__compose-radio ${category === opt.key ? 'wachuneed__compose-radio--active' : ''}`}
                >
                  <input
                    type='radio'
                    name='category'
                    value={opt.key}
                    checked={category === opt.key}
                    onChange={handleCategoryChange}
                  />
                  <span>{intl.formatMessage(opt.label)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {showSections && (
            <label className='wachuneed__compose-field'>
              <span className='wachuneed__compose-label'>
                <FormattedMessage {...messages.labelSection} />
              </span>
              <select
                className='wachuneed__compose-input'
                value={sectionId}
                onChange={handleSectionChange}
              >
                <option value=''>
                  {intl.formatMessage(messages.sectionNone)}
                </option>
                {shopSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {kind === 'offer' && (
            <label className='wachuneed__compose-check'>
              <input
                type='checkbox'
                checked={ongoing}
                onChange={handleOngoing}
              />
              <span>
                <FormattedMessage {...messages.ongoing} />
              </span>
            </label>
          )}

          {kind === 'offer' && (
            <ListingVariantsEditor
              state={variantState}
              onChange={setVariantState}
            />
          )}

          {comesInKinds ? (
            <p className='wachuneed__compose-hint'>
              <FormattedMessage {...messages.priceFromKinds} />
            </p>
          ) : (
            <label className='wachuneed__compose-field'>
              <span className='wachuneed__compose-label'>
                <FormattedMessage
                  {...(kind === 'wanted'
                    ? messages.labelBudget
                    : messages.labelPrice)}
                />
              </span>
              <input
                type='number'
                min={0}
                step={0.01}
                className='wachuneed__compose-input'
                value={price}
                onChange={handlePriceChange}
                placeholder={intl.formatMessage(
                  kind === 'wanted'
                    ? messages.placeholderBudget
                    : messages.placeholderPrice,
                )}
              />
            </label>
          )}

          {kind === 'offer' && !comesInKinds && (
            <label className='wachuneed__compose-field'>
              <span className='wachuneed__compose-label'>
                <FormattedMessage {...messages.labelAvailability} />
              </span>
              <select
                className='wachuneed__compose-input'
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
              </select>
            </label>
          )}

          {kind === 'offer' && (
            <ListingOptionsEditor
              category={category}
              rows={optionRows}
              onChange={setOptionRows}
            />
          )}

          <label className='wachuneed__compose-field'>
            <span className='wachuneed__compose-label'>
              <FormattedMessage {...messages.labelLocation} />
            </span>
            <input
              type='text'
              className='wachuneed__compose-input'
              value={location}
              onChange={handleLocationChange}
              placeholder={intl.formatMessage(messages.placeholderLocation)}
            />
          </label>

          <ListingPhotoField state={photoState} showsChoices={showsChoices} />

          <fieldset className='wachuneed__compose-field'>
            <legend className='wachuneed__compose-label'>
              <FormattedMessage {...messages.labelEnquiries} />
            </legend>
            <div className='wachuneed__compose-radio-group'>
              {ENQUIRY_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className={`wachuneed__compose-radio ${shownEnquiries === opt.key ? 'wachuneed__compose-radio--active' : ''}`}
                >
                  <input
                    type='radio'
                    name='enquiries'
                    value={opt.key}
                    checked={shownEnquiries === opt.key}
                    onChange={handleEnquiries}
                  />
                  <span>{intl.formatMessage(opt.label)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Only where there is a choice to make: a shop item not yet in
              the feed. An ordinary listing is always posted. */}
          {editing && kind === 'offer' && !wasAnnounced && (
            <div className='wachuneed__compose-field'>
              <label className='wachuneed__compose-check'>
                <input
                  type='checkbox'
                  checked={announced}
                  onChange={handleAnnounced}
                />
                <span>
                  <FormattedMessage {...messages.announce} />
                </span>
              </label>
              <p className='wachuneed__compose-hint'>
                <FormattedMessage {...messages.announceHint} />
              </p>
            </div>
          )}

          {error && <p className='wachuneed__compose-error'>{error}</p>}

          <button
            type='submit'
            className='wachuneed__compose-submit'
            disabled={!canSubmit}
          >
            {intl.formatMessage(
              editing
                ? submitting
                  ? messages.saving
                  : messages.save
                : submitting
                  ? messages.submitting
                  : messages.submit,
            )}
          </button>

          {editing && loadedState !== null && loadedState !== 'closed' && (
            <div className='wachuneed__compose-takedown'>
              {askTakeDown ? (
                <>
                  <p className='wachuneed__compose-hint'>
                    <FormattedMessage {...messages.takeDownAsk} />
                  </p>
                  <div className='wachuneed__compose-takedown-actions'>
                    <button
                      type='button'
                      className='wachuneed__compose-takedown-btn wachuneed__compose-takedown-btn--confirm'
                      onClick={handleTakeDown}
                      disabled={takingDown}
                    >
                      <FormattedMessage {...messages.takeDownConfirm} />
                    </button>
                    <button
                      type='button'
                      className='wachuneed__compose-takedown-btn'
                      onClick={handleTakeDownCancel}
                      disabled={takingDown}
                    >
                      <FormattedMessage {...messages.takeDownCancel} />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type='button'
                  className='wachuneed__compose-takedown-btn'
                  onClick={handleTakeDownAsk}
                >
                  <FormattedMessage {...messages.takeDown} />
                </button>
              )}
            </div>
          )}
        </form>
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default WachuneedNew;
