import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory, useLocation } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import api from 'mastodon/api';
import { Stage } from 'mastodon/components/stage';
import { useIdentity } from 'mastodon/identity_context';

import { BoothDock } from './components/booth_dock';
import { BoothGridCard } from './components/booth_grid_card';
import { EditForm } from './components/edit_form';
import { ShareForm } from './components/share_form';
import { UploadForm } from './components/upload_form';
import type { BoothSet } from './types';

// The Booth — native Musik lens (replaces the iframe prototype). The
// SpaceNav badge + intro come from the Frame; lenses are the manifest
// `views:` (Musik / Artists / Events / Live / Me) driven by the URL.
// Only Musik is built here — the others are coming-soon panels pending
// their own surfaces (Artists roster, Events/Nights, Live, Me).

type Lens = 'musik' | 'artists' | 'events' | 'live' | 'me';
const LENS_KEYS: readonly string[] = [
  'musik',
  'artists',
  'events',
  'live',
  'me',
];
type Size = 'compact' | 'standard' | 'large';
const SIZES: { key: Size; label: string }[] = [
  { key: 'compact', label: 'Compact' },
  { key: 'standard', label: 'Standard' },
  { key: 'large', label: 'Large' },
];

const messages = defineMessages({
  heading: { id: 'booth.title', defaultMessage: 'The Booth' },
  empty: {
    id: 'booth.empty',
    defaultMessage: 'No sets yet. Be the first to upload!',
  },
  uploadSet: { id: 'booth.upload_set', defaultMessage: 'Upload set' },
  loading: { id: 'booth.loading', defaultMessage: 'Loading sets…' },
  soon: {
    id: 'booth.lens_soon',
    defaultMessage: 'Coming soon — this lens lands in a follow-up.',
  },
});

function lensFromPath(pathname: string): Lens {
  const match = /^\/hub\/booth\/([a-z]+)/.exec(pathname);
  const seg = match?.[1];
  return seg && LENS_KEYS.includes(seg) ? (seg as Lens) : 'musik';
}

const Booth: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const { signedIn } = useIdentity();
  const location = useLocation();
  const history = useHistory();
  const lens = lensFromPath(location.pathname);

  const [sets, setSets] = useState<BoothSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState<Size>('standard');
  const [editingSet, setEditingSet] = useState<BoothSet | null>(null);
  const [sharingSet, setSharingSet] = useState<BoothSet | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  useEffect(() => {
    void api()
      .get<BoothSet[]>('/api/v1/booth_sets')
      .then((res) => {
        setSets(res.data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleOpen = useCallback(
    (set: BoothSet) => {
      history.push(`/hub/booth/sets/${set.id}`);
    },
    [history],
  );

  const handleEdit = useCallback((set: BoothSet) => {
    setSharingSet(null);
    setShowUpload(false);
    setEditingSet(set);
  }, []);

  const handleEditSuccess = useCallback((updated: BoothSet) => {
    setSets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setEditingSet(null);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setSets((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleShare = useCallback((set: BoothSet) => {
    setEditingSet(null);
    setShowUpload(false);
    setSharingSet(set);
  }, []);

  const handleShareSuccess = useCallback(() => {
    setSharingSet(null);
    setShareToast(true);
    setTimeout(() => {
      setShareToast(false);
    }, 2500);
  }, []);

  const handleUploadSuccess = useCallback((set: BoothSet) => {
    setSets((prev) => [set, ...prev]);
    setShowUpload(false);
  }, []);

  const handleShowUpload = useCallback(() => {
    setEditingSet(null);
    setSharingSet(null);
    setShowUpload(true);
  }, []);
  const handleCancelUpload = useCallback(() => {
    setShowUpload(false);
  }, []);
  const handleCancelEdit = useCallback(() => {
    setEditingSet(null);
  }, []);
  const handleCancelShare = useCallback(() => {
    setSharingSet(null);
  }, []);

  const handleSizeCompact = useCallback(() => {
    setSize('compact');
  }, []);
  const handleSizeStandard = useCallback(() => {
    setSize('standard');
  }, []);
  const handleSizeLarge = useCallback(() => {
    setSize('large');
  }, []);
  const sizeHandlers: Record<Size, () => void> = {
    compact: handleSizeCompact,
    standard: handleSizeStandard,
    large: handleSizeLarge,
  };

  const overlayOpen = showUpload || editingSet !== null || sharingSet !== null;

  return (
    <Stage label={intl.formatMessage(messages.heading)}>
      <Helmet>
        <title>{intl.formatMessage(messages.heading)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>

      <div className='booth-native'>
        {showUpload && (
          <UploadForm
            onSuccess={handleUploadSuccess}
            onCancel={handleCancelUpload}
          />
        )}
        {editingSet && (
          <EditForm
            set={editingSet}
            onSuccess={handleEditSuccess}
            onCancel={handleCancelEdit}
          />
        )}
        {sharingSet && (
          <ShareForm
            set={sharingSet}
            onSuccess={handleShareSuccess}
            onCancel={handleCancelShare}
          />
        )}
        {shareToast && (
          <div className='booth-native__toast'>Shared to your feed</div>
        )}

        {!overlayOpen && lens === 'musik' && (
          <>
            <div className='booth-native__toolbar'>
              <div className='booth-seg' role='group' aria-label='Card size'>
                {SIZES.map((s) => (
                  <button
                    key={s.key}
                    type='button'
                    className='booth-seg__btn'
                    aria-pressed={size === s.key}
                    onClick={sizeHandlers[s.key]}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {loading && (
              <div className='booth-native__status'>
                {intl.formatMessage(messages.loading)}
              </div>
            )}
            {!loading && sets.length === 0 && (
              <div className='booth-native__status'>
                {intl.formatMessage(messages.empty)}
              </div>
            )}
            {!loading && sets.length > 0 && (
              <div className='booth-gallery' data-size={size}>
                {sets.map((set) => (
                  <BoothGridCard
                    key={set.id}
                    set={set}
                    onOpen={handleOpen}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onShare={handleShare}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {!overlayOpen && lens !== 'musik' && (
          <div className='booth-native__soon'>
            {intl.formatMessage(messages.soon)}
          </div>
        )}
      </div>

      {signedIn && !overlayOpen && (
        <button
          type='button'
          className='booth-fab'
          onClick={handleShowUpload}
          aria-label={intl.formatMessage(messages.uploadSet)}
        >
          <AddIcon />
        </button>
      )}

      <BoothDock />
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Booth;
