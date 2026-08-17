import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory } from 'react-router-dom';

import { ComposeShell } from 'mastodon/components/compose_shell';
import { KornerVisibilityPicker } from 'mastodon/components/korner_visibility_picker';

import { findHouse, HOUSES } from './houses';
import { addPiece } from './pieces_store';
import type { StoredPiece } from './pieces_store';

// /hub/art/composer — the Art composer.
//
// Renders inside the shared <ComposeShell> (same portal-overlay chrome
// every korner uses) with a body that mirrors the browse view's
// taxonomy: pick a discipline (inner wheel), pick a shelf inside it
// (outer wheel), then title + body + optional media + visibility.
//
// No Art::Piece backend exists yet; on submit the piece is persisted
// to localStorage via `pieces_store` so it appears on the matching
// shelf strip immediately (and survives a reload). The media file
// input is present for the composer UX but is NOT persisted — the
// filename gets stored as a placeholder tag on the piece so the user
// sees their upload was noticed. A real upload swap comes with the
// backend.

const messages = defineMessages({
  title: { id: 'art.composer.title', defaultMessage: 'Post a piece' },
  subtitle: {
    id: 'art.composer.subtitle',
    defaultMessage: 'Pick a discipline, pick a shelf, share the piece.',
  },
  submit: { id: 'art.composer.submit', defaultMessage: 'Post' },
  submitting: {
    id: 'art.composer.submitting',
    defaultMessage: 'Posting…',
  },
  disciplineLabel: {
    id: 'art.composer.discipline',
    defaultMessage: 'Discipline',
  },
  shelfLabel: { id: 'art.composer.shelf', defaultMessage: 'Shelf' },
  titleLabel: { id: 'art.composer.title_label', defaultMessage: 'Title' },
  titlePlaceholder: {
    id: 'art.composer.title_placeholder',
    defaultMessage: 'A short name for this piece',
  },
  bodyLabel: {
    id: 'art.composer.body_label',
    defaultMessage: 'Body',
  },
  bodyPlaceholder: {
    id: 'art.composer.body_placeholder',
    defaultMessage:
      'Write the piece, or a short preview the browser sees before opening it.',
  },
  mediaLabel: {
    id: 'art.composer.media_label',
    defaultMessage: 'Attach media (optional)',
  },
  mediaHint: {
    id: 'art.composer.media_hint',
    defaultMessage:
      'Photo, video, audio — pick as many as you like. Real uploads land with the backend; for now the filenames are remembered.',
  },
  mediaCount: {
    id: 'art.composer.media_count',
    defaultMessage:
      '{count, plural, one {# file selected} other {# files selected}}',
  },
  visibilityLabel: {
    id: 'art.composer.visibility_label',
    defaultMessage: 'Who sees this?',
  },
});

interface ComposerProps {
  onClose?: () => void;
}

const ArtComposer: React.FC<ComposerProps> = ({ onClose }) => {
  const intl = useIntl();
  const history = useHistory();

  const [houseKey, setHouseKey] = useState<string>(
    HOUSES[0]?.bubble.key ?? 'writing',
  );
  const currentHouse = useMemo(() => findHouse(houseKey), [houseKey]);
  const [shelfKey, setShelfKey] = useState<string>(
    currentHouse?.slices[0]?.key ?? '',
  );
  const [pieceTitle, setPieceTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [visibility, setVisibility] = useState<string>('public');
  // Multiple file selection — Art is subsuming the Albutts space
  // (Tal 2026-08-17 "this is going to takeover the albutts space,
  // so let's keep the functionality"), so we accept a list of media
  // instead of a single file. Filenames are the payload for now;
  // when the backend lands each name becomes a real upload.
  const [mediaNames, setMediaNames] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const shelves = currentHouse?.slices ?? [];
  const currentShelf = shelves.find((s) => s.key === shelfKey) ?? shelves[0];

  const canSubmit =
    !submitting &&
    Boolean(currentHouse) &&
    Boolean(currentShelf) &&
    pieceTitle.trim().length > 0 &&
    body.trim().length > 0;

  const handleDisciplineChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const next = event.target.value;
      setHouseKey(next);
      const nextHouse = findHouse(next);
      setShelfKey(nextHouse?.slices[0]?.key ?? '');
    },
    [],
  );

  const handleShelfChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setShelfKey(event.target.value);
    },
    [],
  );

  const handleMediaChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) {
        setMediaNames([]);
        return;
      }
      setMediaNames(Array.from(files).map((file) => file.name));
    },
    [],
  );

  const handleTitleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setPieceTitle(event.target.value);
    },
    [],
  );

  const handleBodyChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setBody(event.target.value);
    },
    [],
  );

  const goBack = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }
    history.push('/hub/art');
  }, [history, onClose]);

  const handleSubmit = useCallback(() => {
    if (!canSubmit || !currentHouse || !currentShelf) return;
    setSubmitting(true);
    const piece: StoredPiece = {
      // Unique key: shelf + timestamp keeps it stable per submission
      // without needing a UUID lib. Prefixed so it never collides
      // with a hand-authored mock piece key.
      key: `user-${currentShelf.key}-${Date.now()}`,
      houseKey: currentHouse.bubble.key,
      shelfKey: currentShelf.key,
      title: pieceTitle.trim(),
      description: body.trim(),
      author: 'You',
      // The mock/browse view uses a display-relative string here
      // (e.g. "3 hours ago"). Until we render actual dates, "just
      // now" is the accurate label for a piece the user just posted.
      publishedAt: 'just now',
      topic: currentShelf.label,
      visibility,
      mediaNames: mediaNames.length > 0 ? mediaNames : undefined,
    };
    addPiece(piece);
    // Navigate back to the browse view. The user-pieces hook picks
    // up the new entry via the CHANGE_EVENT / storage listener.
    goBack();
  }, [
    canSubmit,
    currentHouse,
    currentShelf,
    pieceTitle,
    body,
    visibility,
    mediaNames,
    goBack,
  ]);

  return (
    <>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>
      <ComposeShell
        korner='art'
        label={intl.formatMessage(messages.title)}
        subtitle={intl.formatMessage(messages.subtitle)}
        submitLabel={intl.formatMessage(messages.submit)}
        submittingLabel={intl.formatMessage(messages.submitting)}
        submitting={submitting}
        canSubmit={canSubmit}
        onSubmit={handleSubmit}
        onCancel={goBack}
      >
        <div className='art-composer'>
          <div className='art-composer__row art-composer__row--split'>
            <label className='art-composer__field'>
              <span className='art-composer__label'>
                {intl.formatMessage(messages.disciplineLabel)}
              </span>
              <select
                className='art-composer__select'
                value={houseKey}
                onChange={handleDisciplineChange}
                disabled={submitting}
              >
                {HOUSES.map((house) => (
                  <option key={house.bubble.key} value={house.bubble.key}>
                    {house.bubble.label}
                  </option>
                ))}
              </select>
            </label>
            <label className='art-composer__field'>
              <span className='art-composer__label'>
                {intl.formatMessage(messages.shelfLabel)}
              </span>
              <select
                className='art-composer__select'
                value={shelfKey}
                onChange={handleShelfChange}
                disabled={submitting || shelves.length === 0}
              >
                {shelves.map((shelf) => (
                  <option key={shelf.key} value={shelf.key}>
                    {shelf.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className='art-composer__field'>
            <span className='art-composer__label'>
              {intl.formatMessage(messages.titleLabel)}
            </span>
            <input
              type='text'
              className='art-composer__input'
              value={pieceTitle}
              onChange={handleTitleChange}
              placeholder={intl.formatMessage(messages.titlePlaceholder)}
              disabled={submitting}
              maxLength={140}
            />
          </label>

          <label className='art-composer__field'>
            <span className='art-composer__label'>
              {intl.formatMessage(messages.bodyLabel)}
            </span>
            <textarea
              className='art-composer__textarea'
              value={body}
              onChange={handleBodyChange}
              placeholder={intl.formatMessage(messages.bodyPlaceholder)}
              disabled={submitting}
              rows={6}
            />
          </label>

          <label className='art-composer__field'>
            <span className='art-composer__label'>
              {intl.formatMessage(messages.mediaLabel)}
            </span>
            <input
              type='file'
              multiple
              accept='image/*,video/*,audio/*'
              className='art-composer__file'
              onChange={handleMediaChange}
              disabled={submitting}
            />
            {mediaNames.length > 0 ? (
              <div className='art-composer__media-list'>
                <span className='art-composer__hint art-composer__hint--emph'>
                  {intl.formatMessage(messages.mediaCount, {
                    count: mediaNames.length,
                  })}
                </span>
                <ul className='art-composer__media-names'>
                  {mediaNames.map((name, index) => (
                    // Index in the composite key is safe here: the
                    // list is fully replaced on every input change,
                    // no re-order between renders.
                    <li key={`${name}-${index}`}>{name}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <span className='art-composer__hint'>
                {intl.formatMessage(messages.mediaHint)}
              </span>
            )}
          </label>

          <div className='art-composer__field'>
            <span className='art-composer__label'>
              {intl.formatMessage(messages.visibilityLabel)}
            </span>
            <KornerVisibilityPicker
              slug='art'
              value={visibility}
              onChange={setVisibility}
              disabled={submitting}
              className='art-composer__visibility'
            />
          </div>
        </div>
      </ComposeShell>
    </>
  );
};

// eslint-disable-next-line import/no-default-export -- async-components loader unwraps `.default`
export default ArtComposer;
