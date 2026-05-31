import { useEffect, useState, useCallback, memo } from 'react';

import { FormattedMessage } from 'react-intl';

import { openModal } from 'mastodon/actions/modal';
import { apiGetTaggedMedia } from 'mastodon/api/media_tags';
import type { ApiMediaAttachmentJSON } from 'mastodon/api_types/media_attachments';
import { ColumnBackButton } from 'mastodon/components/column_back_button';
import ScrollableList from 'mastodon/components/scrollable_list';
import { AccountHeader } from 'mastodon/features/account_timeline/components/account_header';
import BundleColumnError from 'mastodon/features/ui/components/bundle_column_error';
import Column from 'mastodon/features/ui/components/column';
import { useAccountId } from 'mastodon/hooks/useAccountId';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const TaggedGalleryItem = memo<{
  attachment: ApiMediaAttachmentJSON;
  onOpen: (attachment: ApiMediaAttachmentJSON) => void;
}>(({ attachment, onOpen }) => {
  const handleClick = useCallback(() => {
    onOpen(attachment);
  }, [attachment, onOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') onOpen(attachment);
    },
    [attachment, onOpen],
  );

  return (
    <div
      className='media-gallery__item media-gallery__item--square'
      role='button'
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <img
        src={attachment.preview_url}
        alt={attachment.description ?? ''}
        className='media-gallery__item-thumbnail'
      />
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

  const handleOpenMedia = useCallback(
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
            onOpen={handleOpenMedia}
          />
        ))}
      </ScrollableList>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default AccountTaggedGallery;
