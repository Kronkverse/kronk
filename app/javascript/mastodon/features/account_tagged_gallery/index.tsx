import { useEffect, useState, useCallback, memo } from 'react';

import { FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import HeadphonesIcon from '@/material-icons/400-24px/headphones-fill.svg?react';
import MovieIcon from '@/material-icons/400-24px/movie-fill.svg?react';
import { openModal } from 'mastodon/actions/modal';
import { apiGetTaggedMedia } from 'mastodon/api/media_tags';
import type { ApiMediaAttachmentJSON } from 'mastodon/api_types/media_attachments';
import { ColumnBackButton } from 'mastodon/components/column_back_button';
import { Icon } from 'mastodon/components/icon';
import ScrollableList from 'mastodon/components/scrollable_list';
import { AccountHeader } from 'mastodon/features/account_timeline/components/account_header';
import BundleColumnError from 'mastodon/features/ui/components/bundle_column_error';
import Column from 'mastodon/features/ui/components/column';
import { useAccountId } from 'mastodon/hooks/useAccountId';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const TaggedGalleryItem = memo<{
  attachment: ApiMediaAttachmentJSON;
  onOpenImage: (attachment: ApiMediaAttachmentJSON) => void;
}>(({ attachment, onOpenImage }) => {
  const isVideo = attachment.type === 'video' || attachment.type === 'gifv';
  const isAudio = attachment.type === 'audio';
  const statusHref =
    attachment.status_account_acct && attachment.status_id
      ? `/@${attachment.status_account_acct}/${attachment.status_id}`
      : undefined;

  const handleClick = useCallback(() => {
    onOpenImage(attachment);
  }, [attachment, onOpenImage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') onOpenImage(attachment);
    },
    [attachment, onOpenImage],
  );

  const thumbnail = (
    <img
      src={attachment.preview_url}
      alt={attachment.description ?? ''}
      className='media-gallery__item-thumbnail'
    />
  );

  const overlay = isVideo ? (
    <div className='media-gallery__item__overlay media-gallery__item__overlay--corner'>
      <Icon id='play' icon={MovieIcon} />
    </div>
  ) : isAudio ? (
    <div className='media-gallery__item__overlay media-gallery__item__overlay--corner'>
      <Icon id='music' icon={HeadphonesIcon} />
    </div>
  ) : null;

  if (isVideo && statusHref) {
    return (
      <div className='media-gallery__item media-gallery__item--square'>
        <Link to={statusHref} className='media-gallery__item-thumbnail'>
          {thumbnail}
          {overlay}
        </Link>
      </div>
    );
  }

  return (
    <div
      className='media-gallery__item media-gallery__item--square'
      role='button'
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {thumbnail}
      {overlay}
    </div>
  );
});
TaggedGalleryItem.displayName = 'TaggedGalleryItem';

export const AccountTaggedGallery: React.FC<{
  multiColumn: boolean;
}> = ({ multiColumn }) => {
  const dispatch = useAppDispatch();
  const accountId = useAccountId();
  const isAccount = useAppSelector((state) =>
    accountId ? !!state.accounts.get(accountId) : false,
  );
  const [attachments, setAttachments] = useState<ApiMediaAttachmentJSON[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!accountId || !isAccount) return;
    setIsLoading(true);
    void apiGetTaggedMedia(accountId)
      .then((data) => {
        setAttachments(data);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [accountId, isAccount]);

  const handleOpenImage = useCallback(
    (attachment: ApiMediaAttachmentJSON) => {
      dispatch(
        openModal({
          modalType: 'IMAGE',
          modalProps: {
            src: attachment.url,
            alt: attachment.description ?? '',
          },
        }),
      );
    },
    [dispatch],
  );

  if (accountId === null) {
    return <BundleColumnError multiColumn={multiColumn} errorType='routing' />;
  }

  return (
    <Column>
      <ColumnBackButton />

      <ScrollableList
        className='account-gallery__container'
        prepend={
          accountId && <AccountHeader accountId={accountId} hideTabs={false} />
        }
        alwaysPrepend
        scrollKey='account_tagged_gallery'
        isLoading={isLoading}
        emptyMessage={
          <FormattedMessage
            id='empty_column.account_tagged_gallery'
            defaultMessage='No tagged photos yet'
          />
        }
        bindToDocument={!multiColumn}
      >
        {attachments.map((attachment) => (
          <TaggedGalleryItem
            key={attachment.id}
            attachment={attachment}
            onOpenImage={handleOpenImage}
          />
        ))}
      </ScrollableList>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default AccountTaggedGallery;
