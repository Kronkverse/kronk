import { useEffect, useState, useCallback, memo } from 'react';

import { FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import HeadphonesIcon from '@/material-icons/400-24px/headphones-fill.svg?react';
import MovieIcon from '@/material-icons/400-24px/movie-fill.svg?react';
import { apiGetTaggedMedia } from 'mastodon/api/media_tags';
import type { ApiMediaAttachmentJSON } from 'mastodon/api_types/media_attachments';
import { ColumnBackButton } from 'mastodon/components/column_back_button';
import { Icon } from 'mastodon/components/icon';
import ScrollableList from 'mastodon/components/scrollable_list';
import { AccountHeader } from 'mastodon/features/account_timeline/components/account_header';
import BundleColumnError from 'mastodon/features/ui/components/bundle_column_error';
import Column from 'mastodon/features/ui/components/column';
import { useAccountId } from 'mastodon/hooks/useAccountId';
import { useAppSelector } from 'mastodon/store';

const PAGE_SIZE = 40;

const TaggedGalleryItem = memo<{
  attachment: ApiMediaAttachmentJSON;
}>(({ attachment }) => {
  const isVideo = attachment.type === 'video' || attachment.type === 'gifv';
  const isAudio = attachment.type === 'audio';
  const statusHref =
    attachment.status_account_acct && attachment.status_id
      ? `/@${attachment.status_account_acct}/${attachment.status_id}`
      : undefined;

  const img = (
    <img
      src={attachment.preview_url}
      alt={attachment.description ?? ''}
      className='tagged-gallery__thumb'
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

  const inner = statusHref ? (
    <Link to={statusHref} className='tagged-gallery__link'>
      {img}
      {overlay}
    </Link>
  ) : (
    <>
      {img}
      {overlay}
    </>
  );

  return <div className='tagged-gallery__item'>{inner}</div>;
});
TaggedGalleryItem.displayName = 'TaggedGalleryItem';

export const AccountTaggedGallery: React.FC<{
  multiColumn: boolean;
}> = ({ multiColumn }) => {
  const accountId = useAccountId();
  const isAccount = useAppSelector((state) =>
    accountId ? !!state.accounts.get(accountId) : false,
  );
  const [attachments, setAttachments] = useState<ApiMediaAttachmentJSON[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!accountId || !isAccount) return;
    setIsLoading(true);
    void apiGetTaggedMedia(accountId)
      .then((data) => {
        setAttachments(data);
        setHasMore(data.length === PAGE_SIZE);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [accountId, isAccount]);

  const handleLoadMore = useCallback(() => {
    if (!accountId || isLoading || attachments.length === 0) return;
    const lastId = attachments[attachments.length - 1]?.id;
    if (!lastId) return;
    setIsLoading(true);
    void apiGetTaggedMedia(accountId, lastId)
      .then((data) => {
        setAttachments((prev) => [...prev, ...data]);
        setHasMore(data.length === PAGE_SIZE);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [accountId, isLoading, attachments]);

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
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        emptyMessage={
          <FormattedMessage
            id='empty_column.account_tagged_gallery'
            defaultMessage='No tagged photos yet'
          />
        }
        bindToDocument={!multiColumn}
      >
        {attachments.map((attachment) => (
          <TaggedGalleryItem key={attachment.id} attachment={attachment} />
        ))}
      </ScrollableList>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default AccountTaggedGallery;
