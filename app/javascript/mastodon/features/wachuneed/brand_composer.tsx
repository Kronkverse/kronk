import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { isAxiosError } from 'axios';

import { apiUploadListingMedia } from 'mastodon/api/wachuneed';
import {
  BRAND_CATEGORIES,
  apiCreateWachuneedBrand,
  apiGetWachuneedBrand,
  apiRemoveWachuneedBrand,
  apiUpdateWachuneedBrand,
  isBrandCategory,
} from 'mastodon/api/wachuneed_brands';
import type {
  ApiBrandJSON,
  BrandCategory,
} from 'mastodon/api/wachuneed_brands';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import {
  ComposeBody,
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeSelect,
  ComposeTitle,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { PhotoDropZone } from 'mastodon/components/media';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';
import { useDraft } from 'mastodon/hooks/useDraft';

import { brandCategoryMessages } from './brand_card';

// The brand composer (docs/spaces/wachuneed.md, Brands): propose a brand
// for Brands, or change one you proposed. The standard composer overlay
// (`<ComposeShell>`) with the composer kit: a logo or picture, the name,
// its website, why we back them (required), and a category from the fixed
// list. No reach control: brands are for every member. No Konnect row: a
// brand isn't Wachuneed's record to Konnect (that is a listing).
//
// A new brand is saved as a draft as it is written (`wachuneed`/`brand`);
// changing one already proposed isn't. Editing ends with Take this brand
// down, which asks first.

const messages = defineMessages({
  titleNew: {
    id: 'wachuneed.brands.compose.title_new',
    defaultMessage: 'Propose a brand',
  },
  titleEdit: {
    id: 'wachuneed.brands.compose.title_edit',
    defaultMessage: 'Edit brand',
  },
  subtitle: {
    id: 'wachuneed.brands.compose.subtitle',
    defaultMessage:
      'It joins Brands once enough members back it. You count as the first.',
  },
  propose: {
    id: 'wachuneed.brands.compose.propose',
    defaultMessage: 'Propose',
  },
  save: { id: 'wachuneed.brands.compose.save', defaultMessage: 'Save' },
  saving: {
    id: 'wachuneed.brands.compose.saving',
    defaultMessage: 'Saving…',
  },
  loading: {
    id: 'wachuneed.brands.compose.loading',
    defaultMessage: 'Loading brand…',
  },
  loadError: {
    id: 'wachuneed.brands.compose.load_error',
    defaultMessage: "Couldn't load this brand.",
  },
  name: { id: 'wachuneed.brands.compose.name', defaultMessage: 'Name' },
  namePlaceholder: {
    id: 'wachuneed.brands.compose.name_placeholder',
    defaultMessage: 'The brand’s name',
  },
  url: { id: 'wachuneed.brands.compose.url', defaultMessage: 'Website' },
  urlHint: {
    id: 'wachuneed.brands.compose.url_hint',
    defaultMessage: 'Where people can find them.',
  },
  why: {
    id: 'wachuneed.brands.compose.why',
    defaultMessage: 'Why we back them',
  },
  whyPlaceholder: {
    id: 'wachuneed.brands.compose.why_placeholder',
    defaultMessage:
      'Why we back them: what they do, how they do it, and how you know.',
  },
  category: {
    id: 'wachuneed.brands.compose.category',
    defaultMessage: 'Category',
  },
  categoryNone: {
    id: 'wachuneed.brands.compose.category_none',
    defaultMessage: 'No category',
  },
  picture: {
    id: 'wachuneed.brands.compose.picture',
    defaultMessage: 'Add a logo or picture',
  },
  pictureRemove: {
    id: 'wachuneed.brands.compose.picture_remove',
    defaultMessage: 'Remove picture',
  },
  pictureError: {
    id: 'wachuneed.brands.compose.picture_error',
    defaultMessage: "Couldn't upload that picture. Try another?",
  },
  needed: {
    id: 'wachuneed.brands.compose.needed',
    defaultMessage: 'A brand needs a name, a website and why we back them.',
  },
  errorSave: {
    id: 'wachuneed.brands.compose.error',
    defaultMessage: "Couldn't save the brand. Try again?",
  },
  takeDown: {
    id: 'wachuneed.brands.compose.take_down',
    defaultMessage: 'Take this brand down',
  },
  takeDownTitle: {
    id: 'wachuneed.brands.take_down.title',
    defaultMessage: 'Take {name} down?',
  },
  takeDownBody: {
    id: 'wachuneed.brands.take_down.body',
    defaultMessage:
      'It leaves Brands, and its backers with it. This can’t be undone.',
  },
  takeDownConfirm: {
    id: 'wachuneed.brands.take_down.confirm',
    defaultMessage: 'Take it down',
  },
  takeDownCancel: {
    id: 'wachuneed.brands.take_down.cancel',
    defaultMessage: 'Keep it',
  },
  takeDownError: {
    id: 'wachuneed.brands.take_down.error',
    defaultMessage: "Couldn't take the brand down. Try again?",
  },
});

// What a brand draft keeps. The picture goes as its upload id alongside.
interface BrandDraftParams {
  name?: string;
  url?: string;
  why?: string;
  category?: string;
}

// The server's own words for a refusal ("Link must be a web address…"),
// else `fallback`.
const errorFrom = (e: unknown, fallback: string): string => {
  const said: unknown = isAxiosError(e)
    ? (e.response?.data as { error?: unknown } | undefined)?.error
    : null;
  return typeof said === 'string' ? said : fallback;
};

// "zorali.com" means https://zorali.com.
const withScheme = (url: string): string =>
  /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;

interface Props {
  // The brand being changed. Absent for a new one.
  editId?: string;
  onCancel: () => void;
  // Proposed or saved: the brand as it now is. Taken down: null.
  onSaved: (brand: ApiBrandJSON | null) => void;
}

export const BrandComposer: React.FC<Props> = ({
  editId,
  onCancel,
  onSaved,
}) => {
  const intl = useIntl();
  const [confirmDialog, confirm] = useConfirmDialog();

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [why, setWhy] = useState('');
  const [category, setCategory] = useState<BrandCategory | ''>('');
  // undefined: untouched (an edit leaves the picture). null: removed. A
  // string: an upload's id.
  const [pictureId, setPictureId] = useState<string | null | undefined>();
  const [picturePreview, setPicturePreview] = useState<string | null>(null);
  const [pictureBusy, setPictureBusy] = useState(false);

  const [loading, setLoading] = useState(!!editId);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Free a picked picture's preview when it is replaced or the composer
  // closes.
  useEffect(
    () => () => {
      if (picturePreview?.startsWith('blob:'))
        URL.revokeObjectURL(picturePreview);
    },
    [picturePreview],
  );

  const applyDraft = useCallback(
    (d: ApiComposerDraftJSON<BrandDraftParams> | null) => {
      const p = d?.params ?? {};
      setName(p.name ?? '');
      setUrl(p.url ?? '');
      setWhy(p.why ?? '');
      setCategory(isBrandCategory(p.category) ? p.category : '');
      const picture = d?.media_attachments[0];
      setPictureId(picture ? picture.id : undefined);
      setPicturePreview(picture ? picture.preview_url || picture.url : null);
      setError(null);
    },
    [],
  );

  const draft = useDraft<BrandDraftParams>({
    korner: 'wachuneed',
    kind: 'brand',
    context: null,
    snapshot: {
      params: { name, url, why, category },
      mediaIds: pictureId ? [pictureId] : [],
    },
    hasContent:
      name.trim() !== '' ||
      url.trim() !== '' ||
      why.trim() !== '' ||
      !!pictureId,
    apply: applyDraft,
    describe: (d) => d.params.name,
    active: !editId,
    paused: busy,
    locked: pictureBusy,
  });
  const finishDraft = draft.finish;

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;

    apiGetWachuneedBrand(editId)
      .then((brand) => {
        if (cancelled) return undefined;
        setName(brand.name);
        setUrl(brand.url);
        setWhy(brand.why);
        setCategory(brand.category ?? '');
        setPicturePreview(brand.picture_url);
        setLoading(false);
        return undefined;
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editId]);

  const handleName = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setName(e.target.value);
    },
    [],
  );
  const handleUrl = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setUrl(e.target.value);
    },
    [],
  );
  const handleWhy = useCallback<React.ChangeEventHandler<HTMLTextAreaElement>>(
    (e) => {
      setWhy(e.target.value);
    },
    [],
  );
  const handleCategory = useCallback<
    React.ChangeEventHandler<HTMLSelectElement>
  >((e) => {
    const value = e.target.value;
    setCategory(isBrandCategory(value) ? value : '');
  }, []);

  const pictureError = intl.formatMessage(messages.pictureError);
  const handlePicture = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;

      setError(null);
      setPictureBusy(true);
      setPicturePreview(URL.createObjectURL(file));
      apiUploadListingMedia(file)
        .then((uploaded) => {
          setPictureId(uploaded.id);
          return undefined;
        })
        .catch(() => {
          setPicturePreview(null);
          setError(pictureError);
        })
        .finally(() => {
          setPictureBusy(false);
        });
    },
    [pictureError],
  );
  const handlePictureRemove = useCallback(() => {
    setPicturePreview(null);
    setPictureId(null);
  }, []);

  const complete = name.trim() !== '' && url.trim() !== '' && why.trim() !== '';
  // Left enabled while something is missing, so Propose can say what.
  const canSubmit = !busy && !pictureBusy && !loading && !loadError;

  const errorSave = intl.formatMessage(messages.errorSave);
  const handleSubmit = useCallback(() => {
    if (!complete) {
      setError(intl.formatMessage(messages.needed));
      return;
    }

    setBusy(true);
    setError(null);

    const fields = {
      name: name.trim(),
      url: withScheme(url.trim()),
      why: why.trim(),
      category: category || null,
      ...(pictureId !== undefined ? { picture_id: pictureId } : {}),
    };

    void (async () => {
      try {
        const brand = editId
          ? await apiUpdateWachuneedBrand(editId, fields)
          : await apiCreateWachuneedBrand(fields);
        if (!editId) finishDraft();
        onSaved(brand);
      } catch (e: unknown) {
        setError(errorFrom(e, errorSave));
        setBusy(false);
      }
    })();
  }, [
    complete,
    intl,
    name,
    url,
    why,
    category,
    pictureId,
    editId,
    finishDraft,
    onSaved,
    errorSave,
  ]);

  const takeDownError = intl.formatMessage(messages.takeDownError);
  const handleTakeDown = useCallback(() => {
    if (!editId) return;

    void (async () => {
      const ok = await confirm({
        title: intl.formatMessage(messages.takeDownTitle, {
          name: name.trim(),
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
        await apiRemoveWachuneedBrand(editId);
        onSaved(null);
      } catch {
        setError(takeDownError);
        setBusy(false);
      }
    })();
  }, [confirm, editId, intl, name, onSaved, takeDownError]);

  return (
    <ComposeShell
      korner='wachuneed'
      label={intl.formatMessage(
        editId ? messages.titleEdit : messages.titleNew,
      )}
      subtitle={editId ? undefined : intl.formatMessage(messages.subtitle)}
      submitLabel={intl.formatMessage(
        editId ? messages.save : messages.propose,
      )}
      submittingLabel={intl.formatMessage(messages.saving)}
      submitting={busy}
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      draft={draft}
      konnect={null}
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
          <div className='wachuneed-brand-composer__picture'>
            {picturePreview ? (
              <>
                <img
                  src={picturePreview}
                  alt=''
                  className='wachuneed-brand-composer__picture-preview'
                />
                <KornerPill
                  label={intl.formatMessage(messages.pictureRemove)}
                  onClick={handlePictureRemove}
                  disabled={busy || pictureBusy}
                />
              </>
            ) : (
              <PhotoDropZone
                onFiles={handlePicture}
                multiple={false}
                disabled={busy || pictureBusy}
                label={intl.formatMessage(messages.picture)}
              />
            )}
          </div>

          <ComposeTitle
            value={name}
            onChange={handleName}
            placeholder={intl.formatMessage(messages.namePlaceholder)}
            aria-label={intl.formatMessage(messages.name)}
            maxLength={80}
          />

          <ComposeField
            label={<FormattedMessage {...messages.url} />}
            hint={<FormattedMessage {...messages.urlHint} />}
          >
            <ComposeInput
              type='url'
              inputMode='url'
              value={url}
              onChange={handleUrl}
              placeholder='https://'
              maxLength={500}
            />
          </ComposeField>

          <ComposeBody
            value={why}
            onChange={handleWhy}
            placeholder={intl.formatMessage(messages.whyPlaceholder)}
            aria-label={intl.formatMessage(messages.why)}
            maxLength={1000}
            rows={4}
          />

          <ComposeField label={<FormattedMessage {...messages.category} />}>
            <ComposeSelect value={category} onChange={handleCategory}>
              <option value=''>
                {intl.formatMessage(messages.categoryNone)}
              </option>
              {BRAND_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {intl.formatMessage(brandCategoryMessages[value])}
                </option>
              ))}
            </ComposeSelect>
          </ComposeField>

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
