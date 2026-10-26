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
import { LoadingState } from 'mastodon/components/loading_state';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';
import { useDraft } from 'mastodon/hooks/useDraft';
import type { KonnectTarget } from 'mastodon/hooks/useKonnect';
import { useKonnect } from 'mastodon/hooks/useKonnect';

import { optionRowsFrom, optionRowsToPayload } from './listing_options_editor';
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
// shop, whether there is one to be had, and its variations. It does not
// ask what the listing form asks of a one-off (offering or looking for,
// where the exchange happens, a category, extras, whether there is only
// one): a shop item is on offer and keeps selling, and the shop says where
// it is based (Tal, 2026-10-14). Who can see it, and so message you about
// it, is the reach control in the header; a new item starts on the shop's
// (Tal, 2026-10-19: "full control to seller").
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
    defaultMessage: 'Each kind has its own price, set under Variations.',
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
      'It leaves your shop, Wachuneed and the feed. It stays in Mine, marked closed, and cannot be put back up. To pause an item, set who can see it to Me.',
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

const isCategory = (value: string): value is Category =>
  value === 'creation' || value === 'goods' || value === 'service';

// What an item draft keeps (docs/design.md, Drafts). The photos go as
// upload ids alongside, and which choice each shows by the same ids. What
// this composer doesn't ask (category, extras, where) isn't kept.
interface ItemDraftParams {
  title?: string;
  description?: string;
  price?: string;
  sectionId?: string;
  availability?: ListingAvailability;
  variantState?: VariantState;
  announced?: boolean;
  visibility?: ListingVisibility;
  photoShows?: Record<string, string>;
  konnections?: KonnectTarget[];
}

interface Props {
  // The shop's sections, in the seller's order.
  sections: ApiShopSectionJSON[];
  // Who can see the shop: where a new item starts.
  shopVisibility: ListingVisibility;
  // The item being changed. Absent for a new one.
  editId?: string;
  onCancel: () => void;
  // Something was added, changed or taken down. `again` when the seller is
  // carrying on to the next item, so the composer stays open.
  onSaved: (again: boolean) => void;
}

export const ShopItemComposer: React.FC<Props> = ({
  sections,
  shopVisibility,
  editId,
  onCancel,
  onSaved,
}) => {
  const intl = useIntl();
  const [confirmDialog, confirm] = useConfirmDialog();

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
  // Not asked here: a shop item is something the seller keeps selling,
  // made by them, with no extras. An item that says otherwise (set on the
  // listing form) keeps what it says.
  const [ongoing, setOngoing] = useState(true);
  const [announced, setAnnounced] = useState(false);
  const [visibility, setVisibility] =
    useState<ListingVisibility>(shopVisibility);
  // Whether it had already been posted when loaded: that cannot be undone.
  const [wasAnnounced, setWasAnnounced] = useState(false);
  const [again, setAgain] = useState(false);
  // The name of the item just added, when carrying on to the next.
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const photoState = useListingPhotos();
  const { load: loadPhotos } = photoState;
  // What the new item will be Konnected to (decisions.md, 2026-10-23).
  const konnect = useKonnect('wachuneed');
  const restoreKonnect = konnect.restore;
  const commitKonnect = konnect.commit;

  const [loading, setLoading] = useState(!!editId);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const comesInKinds = hasVariants(variantState);
  const showsChoices = useMemo(
    () => (comesInKinds ? variantValues(variantState) : []),
    [comesInKinds, variantState],
  );

  // Drafts: a new item is saved as you go, here and on the server, and
  // comes back when the composer opens again. Changing an item already in
  // the shop doesn't keep one.
  const applyDraft = useCallback(
    (d: ApiComposerDraftJSON<ItemDraftParams> | null) => {
      const p = d?.params ?? {};
      setTitle(p.title ?? '');
      setDescription(p.description ?? '');
      setPrice(p.price ?? '');
      setSectionId(p.sectionId ?? '');
      setAvailability(p.availability ?? 'available');
      setVariantState(p.variantState ?? EMPTY_VARIANTS);
      setAnnounced(p.announced ?? false);
      setVisibility(p.visibility ?? shopVisibility);
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
    [loadPhotos, restoreKonnect, shopVisibility],
  );

  const draft = useDraft<ItemDraftParams>({
    korner: 'wachuneed',
    kind: 'item',
    context: null,
    snapshot: {
      params: {
        title,
        description,
        price,
        sectionId,
        availability,
        variantState,
        announced,
        visibility,
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
      photoState.ids.length > 0,
    apply: applyDraft,
    describe: (d) => d.params.title,
    active: !editId,
    paused: busy,
  });

  const finishDraft = draft.finish;

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    apiGetWachuneedListing(editId)
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
        setOngoing(listing.ongoing !== false);
        setAnnounced(listing.announced !== false);
        setWasAnnounced(listing.announced !== false);
        setVisibility(listing.visibility ?? 'public');
        loadPhotos(listing.photos ?? []);
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
  }, [editId, loadPhotos]);

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
      ongoing,
      availability,
      announced,
      visibility,
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

        const listing = await apiCreateWachuneedListing({
          ...fields,
          title: name,
          category,
          kind: 'offer',
          state: 'live',
          ...(photoState.ids.length > 0
            ? { media_attachment_ids: photoState.ids }
            : {}),
        });
        finishDraft();
        await commitKonnect('wachuneed', listing.id);

        if (again) {
          // The next item: the same section and category, the rest clean.
          setTitle('');
          setDescription('');
          setPrice('');
          setAvailability('available');
          setVariantState(EMPTY_VARIANTS);
          setOptionRows([]);
          setAnnounced(false);
          setVisibility(shopVisibility);
          loadPhotos([]);
          restoreKonnect(null);
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
    ongoing,
    availability,
    announced,
    visibility,
    shopVisibility,
    photoState,
    showsChoices,
    editId,
    again,
    finishDraft,
    commitKonnect,
    restoreKonnect,
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
      draft={draft}
      konnect={editId ? null : konnect}
      headerAction={
        <ReachDropdown
          value={visibility}
          onChange={setVisibility}
          disabled={busy || loading}
        />
      }
    >
      {confirmDialog}

      {loading && <LoadingState label={intl.formatMessage(messages.loading)} />}
      {loadError && (
        <ComposeHint error>
          <FormattedMessage {...messages.loadError} />
        </ComposeHint>
      )}

      {!loading && !loadError && (
        <>
          {lastAdded && (
            <div role='status'>
              <ComposeHint>
                <FormattedMessage
                  {...messages.added}
                  values={{ name: lastAdded }}
                />
              </ComposeHint>
            </div>
          )}

          <ListingPhotoField state={photoState} showsChoices={showsChoices} />

          <ComposeTitle
            value={title}
            onChange={handleTitle}
            placeholder={intl.formatMessage(messages.namePlaceholder)}
            aria-label={intl.formatMessage(messages.name)}
            maxLength={200}
          />

          {comesInKinds ? (
            <ComposeHint>
              <FormattedMessage {...messages.priceFromKinds} />
            </ComposeHint>
          ) : (
            <ComposeRow>
              <ComposeField label={<FormattedMessage {...messages.price} />}>
                <ComposeInput
                  type='number'
                  min={0}
                  step={0.01}
                  value={price}
                  onChange={handlePrice}
                  placeholder={intl.formatMessage(messages.pricePlaceholder)}
                />
              </ComposeField>
              <ComposeField
                label={<FormattedMessage {...messages.availability} />}
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
            </ComposeRow>
          )}

          {sections.length > 0 && (
            <ComposeField label={<FormattedMessage {...messages.section} />}>
              <ComposeSelect value={sectionId} onChange={handleSection}>
                <option value=''>
                  {intl.formatMessage(messages.sectionNone)}
                </option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </ComposeSelect>
            </ComposeField>
          )}

          <ComposeBody
            value={description}
            onChange={handleDescription}
            placeholder={intl.formatMessage(messages.descriptionPlaceholder)}
            aria-label={intl.formatMessage(messages.description)}
            rows={3}
          />

          <ListingVariantsEditor
            state={variantState}
            onChange={setVariantState}
          />

          {!wasAnnounced && (
            <ComposeCheck
              label={<FormattedMessage {...messages.announce} />}
              hint={<FormattedMessage {...messages.announceHint} />}
              checked={announced}
              onChange={handleAnnounced}
            />
          )}

          {!editId && (
            <ComposeCheck
              label={<FormattedMessage {...messages.again} />}
              checked={again}
              onChange={handleAgain}
            />
          )}

          {error && <ComposeHint error>{error}</ComposeHint>}

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
        </>
      )}
    </ComposeShell>
  );
};
