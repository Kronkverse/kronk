import { useCallback, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link, useHistory } from 'react-router-dom';

import { useDispatch, useSelector } from 'react-redux';

import BarChart4BarsIcon from '@/material-icons/400-24px/bar_chart_4_bars.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import DeleteIcon from '@/material-icons/400-24px/delete.svg?react';
import PushPinIcon from '@/material-icons/400-24px/push_pin.svg?react';
import VisibilityIcon from '@/material-icons/400-24px/visibility.svg?react';
import PhotoLibraryIcon from '@/material-icons/400-24px/photo_library.svg?react';
import { cancelReplyCompose } from 'mastodon/actions/compose';
import { pin, unpin } from 'mastodon/actions/interactions';
import { openModal } from 'mastodon/actions/modal';
import { deleteStatus } from 'mastodon/actions/statuses';
import { ConfirmDialog } from 'mastodon/components/confirm_dialog';
import { Icon } from 'mastodon/components/icon';
import { IconButton } from 'mastodon/components/icon_button';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import { EmbeddedStatusContent } from 'mastodon/features/notifications_v2/components/embedded_status_content';

const messages = defineMessages({
  cancel: { id: 'reply_indicator.cancel', defaultMessage: 'Cancel' },
  whoCanSee: { id: 'edit_indicator.who_can_see', defaultMessage: 'Who can see it' },
  pin: { id: 'edit_indicator.pin', defaultMessage: 'Pin to profile' },
  unpin: { id: 'edit_indicator.unpin', defaultMessage: 'Unpin from profile' },
  delete: { id: 'edit_indicator.delete', defaultMessage: 'Delete' },
  deleteTitle: { id: 'edit_indicator.delete_title', defaultMessage: 'Delete this post?' },
  deleteBody: { id: 'edit_indicator.delete_body', defaultMessage: 'It goes for everyone, replies included. This can’t be undone.' },
});

// Posts have no … menu (docs/decisions.md, 2026-11-08): editing your own post
// is where it is deleted, pinned, and its audience looked at.

export const EditIndicator = () => {
  const intl = useIntl();
  const dispatch = useDispatch();
  const id = useSelector(state => state.getIn(['compose', 'id']));
  const status = useSelector(state => state.getIn(['statuses', id]));
  const account = useSelector(state => state.getIn(['accounts', status?.get('account')]));
  const history = useHistory();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleCancelClick = useCallback(() => {
    dispatch(cancelReplyCompose());
  }, [dispatch]);

  const handleWhoCanSee = useCallback(() => {
    dispatch(openModal({ modalType: 'STATUS_AUDIENCE', modalProps: { statusId: id } }));
  }, [dispatch, id]);

  const handlePin = useCallback(() => {
    dispatch(status.get('pinned') ? unpin(status) : pin(status));
  }, [dispatch, status]);

  const askDelete = useCallback(() => {
    setConfirmingDelete(true);
  }, []);

  const cancelDelete = useCallback(() => {
    setConfirmingDelete(false);
  }, []);

  const handleDelete = useCallback(() => {
    setConfirmingDelete(false);
    dispatch(deleteStatus(id));
    dispatch(cancelReplyCompose());
    history.push('/home');
  }, [dispatch, id, history]);

  if (!status) {
    return null;
  }

  return (
    <div className='edit-indicator'>
      <div className='edit-indicator__header'>
        <div className='edit-indicator__display-name'>
          <Link to={`/@${account.get('acct')}`}>@{account.get('acct')}</Link>
          ·
          <Link to={`/@${account.get('acct')}/${status.get('id')}`}><RelativeTimestamp timestamp={status.get('created_at')} /></Link>
        </div>

        <div className='edit-indicator__cancel'>
          <IconButton title={intl.formatMessage(messages.cancel)} icon='times' iconComponent={CloseIcon} onClick={handleCancelClick} inverted />
        </div>
      </div>

      <EmbeddedStatusContent
        className='edit-indicator__content translate'
        status={status}
      />

      <div className='edit-indicator__tools'>
        <button type='button' className='edit-indicator__tool' onClick={handleWhoCanSee}>
          <Icon id='visibility' icon={VisibilityIcon} />
          {intl.formatMessage(messages.whoCanSee)}
        </button>
        {['public', 'unlisted', 'private'].includes(status.get('visibility')) && (
          <button type='button' className='edit-indicator__tool' onClick={handlePin}>
            <Icon id='push_pin' icon={PushPinIcon} />
            {intl.formatMessage(status.get('pinned') ? messages.unpin : messages.pin)}
          </button>
        )}
        <button type='button' className='edit-indicator__tool edit-indicator__tool--danger' onClick={askDelete}>
          <Icon id='delete' icon={DeleteIcon} />
          {intl.formatMessage(messages.delete)}
        </button>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title={intl.formatMessage(messages.deleteTitle)}
          message={intl.formatMessage(messages.deleteBody)}
          confirmLabel={intl.formatMessage(messages.delete)}
          destructive
          onConfirm={handleDelete}
          onCancel={cancelDelete}
        />
      )}

      {(status.get('poll') || status.get('media_attachments').size > 0) && (
        <div className='edit-indicator__attachments'>
          {status.get('poll') && <><Icon icon={BarChart4BarsIcon} /><FormattedMessage id='reply_indicator.poll' defaultMessage='Poll' /></>}
          {status.get('media_attachments').size > 0 && <><Icon icon={PhotoLibraryIcon} /><FormattedMessage id='reply_indicator.attachments' defaultMessage='{count, plural, one {# attachment} other {# attachments}}' values={{ count: status.get('media_attachments').size }} /></>}
        </div>
      )}
    </div>
  );
};
