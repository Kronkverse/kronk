import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import {
  apiCloseWachuneedListing,
  apiCreateWachuneedListing,
  apiGetWachuneedListing,
  apiUpdateWachuneedListing,
} from 'mastodon/api/wachuneed';
import type { CreateListingParams } from 'mastodon/api/wachuneed';
import type { ApiShopSectionJSON } from 'mastodon/api/wachuneed_shops';
import type { ListingAvailability } from 'mastodon/api_types/wachuneed';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { LoadingState } from 'mastodon/components/loading_state';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';

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

// The shop item composer (docs/spaces/wachuneed.md, The shop builder): how
// a seller fills their shop, one product after another, over the Items
// list. It is the standard composer overlay (`<ComposeShell>`), and asks
// only what a product needs: photos, a name, a price, where it sits in the
// shop, whether there is one to be had, and what it comes in. It does not
// ask what the listing form asks of a one-off (offering or looking for,
// where the exchange happens): a shop item is on offer, and the shop says
// where it is based.
//
// An item is an ordinary listing underneath, so this writes through the
// listings API and the listing form can still open one.

type Category = 'creation' | 'goods' | 'service';

const messages = defineMessages({
  titleNew: { id: 'wachuneed.item.title_new', defaultMessage: 'Add an item' },
  titleEdit: { id: 'wachuneed.item.title_edit', defaultMessage: 'Edit item' },
  add: { id: 'wachuneed.item.add', defaultMessage: 'Add item' },
  save: { id: 'wachuneed.item.save', defaultMessage: 'Save' },
  saving: { id: 'wachuneed.edit.saving', defaultMessage: 'Saving…' },
  loading: { id: 'wachuneed.edit.loading', defaultMessage: 'Loading listing…' },
  loadError: {
    id: 'wachuneed.edit.load_error',
    defaultMessage: "Couldn't load this listing.",
  },
  name: { id: 'wachuneed.item.name', defaultMessage: 'Name' },
  namePlaceholder: {
    id: 'wachuneed.item.name_placeholder',
    defaultMessage: 'What is it called?',
  },
  price: { id: 'wachuneed.new.field.price', defaultMessage: 'Price (in AUD)' },
  pricePlaceholder: {
    id: 'wachuneed.item.price_placeholder',
    defaultMessage: 'Blank if by arrangement',
  },
  priceFromKinds: {
    id: 'wachuneed.new.price_from_kinds',
    defaultMessage: 'Each kind has its own price, set under Comes in.',
  },
  availability: {
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
  section: {
    id: 'wachuneed.new.field.section',
    defaultMessage: 'Section of your shop',
  },
  sectionNone: {
    id: 'wachuneed.new.section.none',
    defaultMessage: 'No section',
  },
  description: {
    id: 'wachuneed.new.field.description',
    defaultMessage: 'Description',
  },
  descriptionPlaceholder: {
    id: 'wachuneed.item.description_placeholder',
    defaultMessage: 'What it is made of, its size, how long it takes.',
  },
  category: { id: 'wachuneed.new.field.category', defaultMessage: 'Category' },
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
  oneOff: {
    id: 'wachuneed.item.one_off',
    defaultMessage: 'There is only one of this',
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
  again: {
    id: 'wachuneed.item.again',
    defaultMessage: 'Add another after this one',
  },
  added: {
    id: 'wachuneed.item.added',
    defaultMessage: 'Added {name}. What is next?',
  },
  errorAdd: {
    id: 'wachuneed.item.error_add',
    defaultMessage: "Couldn't add the item. Try again?",
  },
  errorSave: {
    id: 'wachuneed.edit.error',
    defaultMessage: "Couldn't save your changes. Try again?",
  },
  takeDown: {
    id: 'wachuneed.item.take_down',
    defaultMessage: 'Take this item down',
  },
  takeDownTitle: {
    id: 'wachuneed.item.take_down_title',
    defaultMessage: 'Take {name} down?',
  },
  takeDownBody: {
    id: 'wachuneed.item.take_down_body',
    defaultMessage:
      'It leaves your shop, Wachuneed and the feed. It stays in Mine, marked closed, and cannot be put back up. To pause an item, mark it sold out.',
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
});

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

interface Props {
  // The shop's sections, in the seller's order.
  sections: ApiShopSectionJSON[];
  // The item being changed. Absent for a new one.
  editId?: string;
  // A new item started from another of yours, without its photos.
  copyId?: string;
  onCancel: () => void;
  // Something was added, changed or taken down. `again` when the seller is
  // carrying on to the next item, so the composer stays open.
  onSaved: (again: boolean) => void;
}

export const ShopItemComposer: React.FC<Props> = ({
  sections,
  editId,
  copyId,
  onCancel,
  onSaved,
}) => {
  const intl = useIntl();
  const [confirmDialog, confirm] = useConfirmDialog();
  const loadId = editId ?? copyId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('creation');
  const [price, setPrice] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [availability, setAvailability] =
    useState<ListingAvailability>('available');
  const [variantState, setVariantState] =
    useState<VariantState>(EMPTY_VARIANTS);
  const [optionRows, setOptionRows] = useState<OptionRow[]>([]);
  const [oneOff, setOneOff] = useState(false);
  const [announced, setAnnounced] = useState(false);
  // Whether it had already been posted when loaded: that cannot be undone.
  const [wasAnnounced, setWasAnnounced] = useState(false);
  // Not asked here, but a copy carries its source's along.
  const [location, setLocation] = useState('');
  const [again, setAgain] = useState(false);
  // The name of the item just added, when carrying on to the next.
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const photoState = useListingPhotos();
  const { load: loadPhotos } = photoState;

  const [loading, setLoading] = useState(!!loadId);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loadId) return;
    let cancelled = false;
    apiGetWachuneedListing(loadId)
      .then((listing) => {
        if (cancelled) return;
        setTitle(listing.title);
        setDescription(listing.description ?? '');
        if (isCategory(listing.category)) setCategory(listing.category);
        setPrice(
          typeof listing.price_cents === 'number'
            ? (listing.price_cents / 100).toFixed(2)
            : '',
        );
        setSectionId(listing.shop_section_id ?? '');
        setAvailability(listing.availability ?? 'available');
        setVariantState(variantStateFrom(listing.variants));
        setOptionRows(optionRowsFrom(listing.options));
        setOneOff(!listing.ongoing);
        setLocation(listing.location ?? '');
        // A copy is a new item: not yet posted, and its photos stay with
        // the item copied.
        if (editId) {
          setAnnounced(listing.announced !== false);
          setWasAnnounced(listing.announced !== false);
          loadPhotos(listing.photos ?? []);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editId, loadId, loadPhotos]);

  const handleTitle = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setTitle(e.currentTarget.value);
    },
    [],
  );
  const handleDescription = useCallback<
    React.ChangeEventHandler<HTMLTextAreaElement>
  >((e) => {
    setDescription(e.currentTarget.value);
  }, []);
  const handlePrice = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setPrice(e.currentTarget.value);
    },
    [],
  );
  const handleSection = useCallback<
    React.ChangeEventHandler<HTMLSelectElement>
  >((e) => {
    setSectionId(e.currentTarget.value);
  }, []);
  const handleAvailability = useCallback<
    React.ChangeEventHandler<HTMLSelectElement>
  >((e) => {
    setAvailability(e.currentTarget.value as ListingAvailability);
  }, []);
  const handleCategory = useCallback<
    React.ChangeEventHandler<HTMLSelectElement>
  >((e) => {
    const { value } = e.currentTarget;
    if (isCategory(value)) setCategory(value);
  }, []);
  const handleOneOff = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setOneOff(e.currentTarget.checked);
    },
    [],
  );
  const handleAnnounced = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setAnnounced(e.currentTarget.checked);
  }, []);
  const handleAgain = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setAgain(e.currentTarget.checked);
    },
    [],
  );

  const comesInKinds = hasVariants(variantState);
  const showsChoices = useMemo(
    () => (comesInKinds ? variantValues(variantState) : []),
    [comesInKinds, variantState],
  );

  const canSubmit =
    !loading && !loadError && title.trim().length > 0 && !photoState.uploading;

  const errorAdd = intl.formatMessage(messages.errorAdd);
  const errorSave = intl.formatMessage(messages.errorSave);
  const handleSubmit = useCallback(() => {
    setBusy(true);
    setError(null);

    const name = title.trim();
    const parsedPrice = price.trim();
    const priceCents = parsedPrice
      ? Math.round(parseFloat(parsedPrice) * 100)
      : null;

    const fields: Partial<CreateListingParams> = {
      title: name,
      description: description.trim(),
      category,
      ...(priceCents !== null && Number.isFinite(priceCents)
        ? { price_cents: priceCents, price_currency: 'AUD' }
        : { price_cents: null }),
      ...(sections.length > 0
        ? { listing_shop_section_id: sectionId || null }
        : {}),
      options: optionRowsToPayload(optionRows),
      variants: variantStateToPayload(variantState),
      ongoing: !oneOff,
      availability,
      announced,
      photo_variants: photoState.showsPayload(showsChoices),
    };

    void (async () => {
      try {
        if (editId) {
          // The photos go only if they changed, so saving words never
          // touches the ones already there.
          await apiUpdateWachuneedListing(editId, {
            ...fields,
            ...(photoState.touched
              ? { media_attachment_ids: photoState.ids }
              : {}),
          });
          onSaved(false);
          return;
        }

        await apiCreateWachuneedListing({
          ...fields,
          title: name,
          category,
          kind: 'offer',
          state: 'live',
          location: location.trim() || undefined,
          ...(photoState.ids.length > 0
            ? { media_attachment_ids: photoState.ids }
            : {}),
        });

        if (again) {
          // The next item: the same section and category, the rest clean.
          setTitle('');
          setDescription('');
          setPrice('');
          setAvailability('available');
          setVariantState(EMPTY_VARIANTS);
          setOptionRows([]);
          setAnnounced(false);
          loadPhotos([]);
          setLastAdded(name);
          setBusy(false);
        }
        onSaved(again);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : editId ? errorSave : errorAdd,
        );
        setBusy(false);
      }
    })();
  }, [
    title,
    price,
    description,
    category,
    sections,
    sectionId,
    optionRows,
    variantState,
    oneOff,
    availability,
    announced,
    photoState,
    showsChoices,
    editId,
    location,
    again,
    loadPhotos,
    onSaved,
    errorAdd,
    errorSave,
  ]);

  const takeDownError = intl.formatMessage(messages.takeDownError);
  const handleTakeDown = useCallback(() => {
    if (!editId) return;
    void (async () => {
      const ok = await confirm({
        title: intl.formatMessage(messages.takeDownTitle, {
          name: title.trim(),
        }),
        message: intl.formatMessage(messages.takeDownBody),
        confirmLabel: intl.formatMessage(messages.takeDownConfirm),
        cancelLabel: intl.formatMessage(messages.takeDownCancel),
        destructive: true,
      });
      if (!ok) return;

      setBusy(true);
      setError(null);
      try {
        await apiCloseWachuneedListing(editId);
        onSaved(false);
      } catch {
        setError(takeDownError);
        setBusy(false);
      }
    })();
  }, [confirm, editId, intl, onSaved, takeDownError, title]);

  return (
    <ComposeShell
      korner='wachuneed'
      label={intl.formatMessage(
        editId ? messages.titleEdit : messages.titleNew,
      )}
      submitLabel={intl.formatMessage(editId ? messages.save : messages.add)}
      submittingLabel={intl.formatMessage(messages.saving)}
      submitting={busy}
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    >
      {confirmDialog}

      {loading && <LoadingState label={intl.formatMessage(messages.loading)} />}
      {loadError && (
        <p className='wachuneed__compose-error' role='alert'>
          <FormattedMessage {...messages.loadError} />
        </p>
      )}

      {!loading && !loadError && (
        <div className='wachuneed__compose-form wachuneed-item-form'>
          {lastAdded && (
            <p className='wachuneed__compose-hint' role='status'>
              <FormattedMessage
                {...messages.added}
                values={{ name: lastAdded }}
              />
            </p>
          )}

          <ListingPhotoField state={photoState} showsChoices={showsChoices} />

          <label className='wachuneed__compose-field'>
            <span className='wachuneed__compose-label'>
              <FormattedMessage {...messages.name} />
            </span>
            <input
              type='text'
              className='wachuneed__compose-input'
              value={title}
              onChange={handleTitle}
              placeholder={intl.formatMessage(messages.namePlaceholder)}
              maxLength={200}
            />
          </label>

          {comesInKinds ? (
            <p className='wachuneed__compose-hint'>
              <FormattedMessage {...messages.priceFromKinds} />
            </p>
          ) : (
            <div className='wachuneed-item-form__row'>
              <label className='wachuneed__compose-field'>
                <span className='wachuneed__compose-label'>
                  <FormattedMessage {...messages.price} />
                </span>
                <input
                  type='number'
                  min={0}
                  step={0.01}
                  className='wachuneed__compose-input'
                  value={price}
                  onChange={handlePrice}
                  placeholder={intl.formatMessage(messages.pricePlaceholder)}
                />
              </label>
              <label className='wachuneed__compose-field'>
                <span className='wachuneed__compose-label'>
                  <FormattedMessage {...messages.availability} />
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
            </div>
          )}

          {sections.length > 0 && (
            <label className='wachuneed__compose-field'>
              <span className='wachuneed__compose-label'>
                <FormattedMessage {...messages.section} />
              </span>
              <select
                className='wachuneed__compose-input'
                value={sectionId}
                onChange={handleSection}
              >
                <option value=''>
                  {intl.formatMessage(messages.sectionNone)}
                </option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className='wachuneed__compose-field'>
            <span className='wachuneed__compose-label'>
              <FormattedMessage {...messages.description} />
            </span>
            <textarea
              className='wachuneed__compose-textarea'
              value={description}
              onChange={handleDescription}
              placeholder={intl.formatMessage(messages.descriptionPlaceholder)}
              rows={3}
            />
          </label>

          <ListingVariantsEditor
            state={variantState}
            onChange={setVariantState}
          />

          <label className='wachuneed__compose-field'>
            <span className='wachuneed__compose-label'>
              <FormattedMessage {...messages.category} />
            </span>
            <select
              className='wachuneed__compose-input'
              value={category}
              onChange={handleCategory}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {intl.formatMessage(opt.label)}
                </option>
              ))}
            </select>
          </label>

          <ListingOptionsEditor
            category={category}
            rows={optionRows}
            onChange={setOptionRows}
          />

          <label className='wachuneed__compose-check'>
            <input type='checkbox' checked={oneOff} onChange={handleOneOff} />
            <span>
              <FormattedMessage {...messages.oneOff} />
            </span>
          </label>

          {!wasAnnounced && (
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

          {!editId && (
            <label className='wachuneed__compose-check'>
              <input type='checkbox' checked={again} onChange={handleAgain} />
              <span>
                <FormattedMessage {...messages.again} />
              </span>
            </label>
          )}

          {error && (
            <p className='wachuneed__compose-error' role='alert'>
              {error}
            </p>
          )}

          {editId && (
            <button
              type='button'
              className='compose-shell__delete'
              onClick={handleTakeDown}
              disabled={busy}
            >
              <FormattedMessage {...messages.takeDown} />
            </button>
          )}
        </div>
      )}
    </ComposeShell>
  );
};
