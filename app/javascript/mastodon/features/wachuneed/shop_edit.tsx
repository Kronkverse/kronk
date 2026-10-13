import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { useHistory } from 'react-router-dom';

import ArrowDownwardIcon from '@/material-icons/400-24px/arrow_downward.svg?react';
import ArrowUpwardIcon from '@/material-icons/400-24px/arrow_upward.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import { apiUploadListingMedia } from 'mastodon/api/wachuneed';
import {
  apiCloseWachuneedShop,
  apiGetMyWachuneedShop,
  apiSaveWachuneedShop,
} from 'mastodon/api/wachuneed_shops';
import { Icon } from 'mastodon/components/icon';
import { Stage } from 'mastodon/components/stage';
import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';

// /hub/wachuneed/my-shop — open a shop, or change the one you have.
//
// A shop is a view of the listings you already have (docs/spaces/
// wachuneed.md, Shops), so this form is short: what it is called, the
// sections you want, and two choices about who it reaches. Listings are
// put into a section from their own form.

const MAX_SECTIONS = 12;

const messages = defineMessages({
  titleOpen: {
    id: 'wachuneed.shop_edit.title_open',
    defaultMessage: 'Open a shop',
  },
  titleEdit: {
    id: 'wachuneed.shop_edit.title_edit',
    defaultMessage: 'Your shop',
  },
  intro: {
    id: 'wachuneed.shop_edit.intro',
    defaultMessage:
      'A shop puts everything you have on offer on one page of its own, under sections you name. Your listings stay in Offered as they are.',
  },
  loading: { id: 'wachuneed.shop.loading', defaultMessage: 'Loading shop…' },
  name: { id: 'wachuneed.shop_edit.name', defaultMessage: 'Shop name' },
  description: {
    id: 'wachuneed.shop_edit.description',
    defaultMessage: 'A line about it',
  },
  picture: { id: 'wachuneed.shop_edit.picture', defaultMessage: 'Picture' },
  pictureHint: {
    id: 'wachuneed.shop_edit.picture_hint',
    defaultMessage: 'Optional. Your profile picture is used until you add one.',
  },
  pictureChoose: {
    id: 'wachuneed.shop_edit.picture_choose',
    defaultMessage: 'Choose a picture',
  },
  pictureRemove: {
    id: 'wachuneed.shop_edit.picture_remove',
    defaultMessage: 'Use my profile picture',
  },
  pictureError: {
    id: 'wachuneed.shop_edit.picture_error',
    defaultMessage: "Couldn't upload that picture. Try another?",
  },
  sections: { id: 'wachuneed.shop_edit.sections', defaultMessage: 'Sections' },
  sectionsHint: {
    id: 'wachuneed.shop_edit.sections_hint',
    defaultMessage:
      'Optional. Name them however suits what you sell, such as Skin Care or Tinctures. You choose a section when you list or edit something.',
  },
  sectionName: {
    id: 'wachuneed.shop_edit.section_name',
    defaultMessage: 'Section name',
  },
  sectionAdd: {
    id: 'wachuneed.shop_edit.section_add',
    defaultMessage: 'Add a section',
  },
  sectionUp: {
    id: 'wachuneed.shop_edit.section_up',
    defaultMessage: 'Move up',
  },
  sectionDown: {
    id: 'wachuneed.shop_edit.section_down',
    defaultMessage: 'Move down',
  },
  sectionRemove: {
    id: 'wachuneed.shop_edit.section_remove',
    defaultMessage: 'Remove section',
  },
  enquiries: {
    id: 'wachuneed.shop_edit.enquiries',
    defaultMessage: 'Who can message you about a listing?',
  },
  enquiriesMates: {
    id: 'wachuneed.shop_edit.enquiries_mates',
    defaultMessage: 'Only my Mates',
  },
  enquiriesAnyone: {
    id: 'wachuneed.shop_edit.enquiries_anyone',
    defaultMessage: 'Anyone on Kronk',
  },
  onProfile: {
    id: 'wachuneed.shop_edit.on_profile',
    defaultMessage: 'Show my shop on my profile',
  },
  open: { id: 'wachuneed.shop_edit.open', defaultMessage: 'Open shop' },
  save: { id: 'wachuneed.shop_edit.save', defaultMessage: 'Save shop' },
  saving: { id: 'wachuneed.shop_edit.saving', defaultMessage: 'Saving…' },
  error: {
    id: 'wachuneed.shop_edit.error',
    defaultMessage: "Couldn't save your shop. Try again?",
  },
  close: { id: 'wachuneed.shop_edit.close', defaultMessage: 'Close shop' },
  closeAsk: {
    id: 'wachuneed.shop_edit.close_ask',
    defaultMessage:
      'Closing removes your shop page and its sections. Your listings stay up exactly as they are.',
  },
  closeConfirm: {
    id: 'wachuneed.shop_edit.close_confirm',
    defaultMessage: 'Close it',
  },
  closeCancel: {
    id: 'wachuneed.shop_edit.close_cancel',
    defaultMessage: 'Keep it',
  },
});

interface SectionRow {
  // Stable in the list while editing; `id` is the saved section's, if any.
  key: string;
  id?: string;
  name: string;
}

const WachuneedShopEdit: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const history = useHistory();
  const myAcct = useAppSelector((state) =>
    me ? state.accounts.get(me)?.acct : undefined,
  );

  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [enquiries, setEnquiries] = useState<'mates' | 'anyone'>('mates');
  const [onProfile, setOnProfile] = useState(false);
  const [picturePreview, setPicturePreview] = useState<string | null>(null);
  // undefined: untouched. null: removed. A string: a new upload's id.
  const [pictureId, setPictureId] = useState<string | null | undefined>();
  const [pictureBusy, setPictureBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askClose, setAskClose] = useState(false);
  const nextKey = useRef(0);

  useEffect(() => {
    let cancelled = false;

    apiGetMyWachuneedShop()
      .then((shop) => {
        if (cancelled || !shop) return undefined;
        setExists(true);
        setName(shop.name);
        setDescription(shop.description ?? '');
        setEnquiries(shop.enquiries);
        setOnProfile(shop.show_on_profile);
        setPicturePreview(shop.picture_url ?? null);
        setSections(
          (shop.sections ?? []).map((section) => ({
            key: `saved-${section.id}`,
            id: section.id,
            name: section.name,
          })),
        );
        return undefined;
      })
      .catch(() => {
        // Treated as no shop yet: the form opens one.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleName = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setName(e.currentTarget.value);
    },
    [],
  );
  const handleDescription = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setDescription(e.currentTarget.value);
  }, []);
  const handleEnquiries = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setEnquiries(e.currentTarget.value === 'anyone' ? 'anyone' : 'mates');
  }, []);
  const handleOnProfile = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setOnProfile(e.currentTarget.checked);
  }, []);

  const pictureError = intl.formatMessage(messages.pictureError);
  const handlePicture = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const file = e.currentTarget.files?.[0];
      e.currentTarget.value = '';
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

  const handleSectionAdd = useCallback(() => {
    nextKey.current += 1;
    const key = `new-${nextKey.current}`;
    setSections((prev) => [...prev, { key, name: '' }]);
  }, []);
  const handleSectionName = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    const { key } = e.currentTarget.dataset;
    const { value } = e.currentTarget;
    setSections((prev) =>
      prev.map((row) => (row.key === key ? { ...row, name: value } : row)),
    );
  }, []);
  const handleSectionRemove = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >((e) => {
    const { key } = e.currentTarget.dataset;
    setSections((prev) => prev.filter((row) => row.key !== key));
  }, []);
  const handleSectionMove = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >((e) => {
    const { key, by } = e.currentTarget.dataset;
    setSections((prev) => {
      const from = prev.findIndex((row) => row.key === key);
      const to = from + Number(by);
      const moved = prev[from];
      if (!moved || to < 0 || to >= prev.length) return prev;
      const next = prev.filter((row) => row.key !== key);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const canSubmit = name.trim().length > 0 && !submitting && !pictureBusy;
  const saveError = intl.formatMessage(messages.error);

  const handleSubmit = useCallback<React.FormEventHandler<HTMLFormElement>>(
    (e) => {
      e.preventDefault();
      if (!canSubmit) return;
      setSubmitting(true);
      setError(null);

      apiSaveWachuneedShop({
        name: name.trim(),
        description: description.trim(),
        enquiries,
        show_on_profile: onProfile,
        sections: sections
          .filter((row) => row.name.trim().length > 0)
          .map((row) => ({ id: row.id, name: row.name.trim() })),
        ...(pictureId !== undefined ? { picture_id: pictureId } : {}),
      })
        .then((shop) => {
          history.push(`/hub/wachuneed/shop/${shop.account.acct}`);
          return undefined;
        })
        .catch(() => {
          setError(saveError);
          setSubmitting(false);
        });
    },
    [
      canSubmit,
      name,
      description,
      enquiries,
      onProfile,
      sections,
      pictureId,
      history,
      saveError,
    ],
  );

  const handleCloseAsk = useCallback(() => {
    setAskClose(true);
  }, []);
  const handleCloseCancel = useCallback(() => {
    setAskClose(false);
  }, []);
  const handleClose = useCallback(() => {
    setSubmitting(true);
    apiCloseWachuneedShop()
      .then(() => {
        history.push('/hub/wachuneed/mine');
        return undefined;
      })
      .catch(() => {
        setError(saveError);
        setSubmitting(false);
      });
  }, [history, saveError]);

  const label = intl.formatMessage(
    exists ? messages.titleEdit : messages.titleOpen,
  );

  if (loading) {
    return (
      <Stage label={label}>
        <div className='scrollable wachuneed wachuneed--compose'>
          <p className='wachuneed__status'>
            {intl.formatMessage(messages.loading)}
          </p>
        </div>
      </Stage>
    );
  }

  return (
    <Stage label={label}>
      <div className='scrollable wachuneed wachuneed--compose'>
        {!exists && (
          <p className='wachuneed__compose-intro'>
            <FormattedMessage {...messages.intro} />
          </p>
        )}

        <form className='wachuneed__compose-form' onSubmit={handleSubmit}>
          <label className='wachuneed__compose-field'>
            <span className='wachuneed__compose-label'>
              <FormattedMessage {...messages.name} />
            </span>
            <input
              type='text'
              className='wachuneed__compose-input'
              value={name}
              onChange={handleName}
              maxLength={60}
              required
            />
          </label>

          <label className='wachuneed__compose-field'>
            <span className='wachuneed__compose-label'>
              <FormattedMessage {...messages.description} />
            </span>
            <input
              type='text'
              className='wachuneed__compose-input'
              value={description}
              onChange={handleDescription}
              maxLength={300}
            />
          </label>

          <div className='wachuneed__compose-field'>
            <span className='wachuneed__compose-label'>
              <FormattedMessage {...messages.picture} />
            </span>
            <div className='wachuneed-shop-edit__picture'>
              {picturePreview && (
                <img
                  src={picturePreview}
                  alt=''
                  className='wachuneed-shop-edit__picture-preview'
                />
              )}
              <label className='wachuneed-shop-edit__button'>
                <input
                  type='file'
                  accept='image/*'
                  onChange={handlePicture}
                  className='wachuneed__compose-photo-input'
                />
                <FormattedMessage {...messages.pictureChoose} />
              </label>
              {picturePreview && (
                <button
                  type='button'
                  className='wachuneed-shop-edit__button'
                  onClick={handlePictureRemove}
                >
                  <FormattedMessage {...messages.pictureRemove} />
                </button>
              )}
            </div>
            <p className='wachuneed__compose-hint'>
              <FormattedMessage {...messages.pictureHint} />
            </p>
          </div>

          <div className='wachuneed__compose-field'>
            <span className='wachuneed__compose-label'>
              <FormattedMessage {...messages.sections} />
            </span>
            <ul className='wachuneed-shop-edit__sections'>
              {sections.map((row, index) => (
                <li key={row.key} className='wachuneed-shop-edit__section'>
                  <input
                    type='text'
                    className='wachuneed__compose-input'
                    value={row.name}
                    data-key={row.key}
                    onChange={handleSectionName}
                    maxLength={40}
                    aria-label={intl.formatMessage(messages.sectionName)}
                    placeholder={intl.formatMessage(messages.sectionName)}
                  />
                  <button
                    type='button'
                    className='wachuneed-shop-edit__icon'
                    data-key={row.key}
                    data-by='-1'
                    onClick={handleSectionMove}
                    disabled={index === 0}
                    aria-label={intl.formatMessage(messages.sectionUp)}
                    title={intl.formatMessage(messages.sectionUp)}
                  >
                    <Icon id='arrow_upward' icon={ArrowUpwardIcon} />
                  </button>
                  <button
                    type='button'
                    className='wachuneed-shop-edit__icon'
                    data-key={row.key}
                    data-by='1'
                    onClick={handleSectionMove}
                    disabled={index === sections.length - 1}
                    aria-label={intl.formatMessage(messages.sectionDown)}
                    title={intl.formatMessage(messages.sectionDown)}
                  >
                    <Icon id='arrow_downward' icon={ArrowDownwardIcon} />
                  </button>
                  <button
                    type='button'
                    className='wachuneed-shop-edit__icon'
                    data-key={row.key}
                    onClick={handleSectionRemove}
                    aria-label={intl.formatMessage(messages.sectionRemove)}
                    title={intl.formatMessage(messages.sectionRemove)}
                  >
                    <Icon id='close' icon={CloseIcon} />
                  </button>
                </li>
              ))}
            </ul>
            {sections.length < MAX_SECTIONS && (
              <button
                type='button'
                className='wachuneed-shop-edit__button'
                onClick={handleSectionAdd}
              >
                <FormattedMessage {...messages.sectionAdd} />
              </button>
            )}
            <p className='wachuneed__compose-hint'>
              <FormattedMessage {...messages.sectionsHint} />
            </p>
          </div>

          <fieldset className='wachuneed__compose-field'>
            <legend className='wachuneed__compose-label'>
              <FormattedMessage {...messages.enquiries} />
            </legend>
            <div className='wachuneed__compose-radio-group'>
              {(['mates', 'anyone'] as const).map((value) => (
                <label
                  key={value}
                  className={`wachuneed__compose-radio ${enquiries === value ? 'wachuneed__compose-radio--active' : ''}`}
                >
                  <input
                    type='radio'
                    name='enquiries'
                    value={value}
                    checked={enquiries === value}
                    onChange={handleEnquiries}
                  />
                  <span>
                    {intl.formatMessage(
                      value === 'mates'
                        ? messages.enquiriesMates
                        : messages.enquiriesAnyone,
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className='wachuneed-shop-edit__check'>
            <input
              type='checkbox'
              checked={onProfile}
              onChange={handleOnProfile}
            />
            <span>
              <FormattedMessage {...messages.onProfile} />
            </span>
          </label>

          {error && <p className='wachuneed__compose-error'>{error}</p>}

          <button
            type='submit'
            className='wachuneed__compose-submit'
            disabled={!canSubmit}
          >
            {intl.formatMessage(
              submitting
                ? messages.saving
                : exists
                  ? messages.save
                  : messages.open,
            )}
          </button>

          {exists && (
            <div className='wachuneed__compose-takedown'>
              {askClose ? (
                <>
                  <p className='wachuneed__compose-hint'>
                    <FormattedMessage {...messages.closeAsk} />
                  </p>
                  <div className='wachuneed__compose-takedown-actions'>
                    <button
                      type='button'
                      className='wachuneed__compose-takedown-btn wachuneed__compose-takedown-btn--confirm'
                      onClick={handleClose}
                      disabled={submitting}
                    >
                      <FormattedMessage {...messages.closeConfirm} />
                    </button>
                    <button
                      type='button'
                      className='wachuneed__compose-takedown-btn'
                      onClick={handleCloseCancel}
                      disabled={submitting}
                    >
                      <FormattedMessage {...messages.closeCancel} />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type='button'
                  className='wachuneed__compose-takedown-btn'
                  onClick={handleCloseAsk}
                >
                  <FormattedMessage {...messages.close} />
                </button>
              )}
            </div>
          )}
        </form>

        {/* Where a saved shop lives, for a seller who wants to look first. */}
        {exists && myAcct && (
          <p className='wachuneed__compose-hint'>
            <a href={`/hub/wachuneed/shop/${myAcct}`}>
              /hub/wachuneed/shop/{myAcct}
            </a>
          </p>
        )}
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default WachuneedShopEdit;
