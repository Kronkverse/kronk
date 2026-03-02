import PropTypes from 'prop-types';
import { PureComponent } from 'react';
import { defineMessages, injectIntl, FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';
import ImmutablePropTypes from 'react-immutable-proptypes';
import { connect } from 'react-redux';

import ArrowIcon from '@/material-icons/400-24px/arrow_right_alt.svg?react';
import { Icon } from 'mastodon/components/icon';
import { Avatar } from './avatar';
import { RelativeTimestamp } from './relative_timestamp';
import { IconButton } from './icon_button';
import api from '../api';
import { importFetchedStatuses } from '../actions/importer';
import { showAlertForError } from '../actions/alerts';

const messages = defineMessages({
  replyPlaceholder: { id: 'status.reply_placeholder', defaultMessage: 'Write a reply...' },
  send: { id: 'status.send_reply', defaultMessage: 'Send' },
  reply: { id: 'status.reply_inline', defaultMessage: 'Reply' },
});

const mapStateToProps = (state) => ({
  currentAccount: state.getIn(['accounts', state.getIn(['meta', 'me'])]),
});

const MAX_DEPTH = 4;
const MAX_DIRECT_REPLIES = 5;
const MAX_NESTED_REPLIES = 3;

// Count all descendants in a reply tree node
function countDescendants(node) {
  if (!node.children || node.children.length === 0) return 0;
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}

// Build a recursive reply tree from a flat list of descendants
function buildReplyTree(descendants, parentId, depth = 0) {
  if (depth >= MAX_DEPTH) return [];

  const limit = depth === 0 ? MAX_DIRECT_REPLIES : MAX_NESTED_REPLIES;
  const directReplies = descendants
    .filter(s => s.in_reply_to_id === parentId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(0, limit);

  return directReplies.map(reply => ({
    ...reply,
    children: buildReplyTree(descendants, reply.id, depth + 1),
  }));
}

class ReplyItem extends PureComponent {
  static propTypes = {
    reply: PropTypes.object.isRequired,
    depth: PropTypes.number,
    currentAccount: ImmutablePropTypes.map,
    onReplySubmit: PropTypes.func.isRequired,
    intl: PropTypes.object.isRequired,
  };

  static defaultProps = {
    depth: 0,
  };

  state = {
    showReplyInput: false,
    replyText: '',
    submitting: false,
    childrenExpanded: false,
  };

  handleToggleReply = () => {
    this.setState(state => ({ showReplyInput: !state.showReplyInput, replyText: '' }));
  };

  handleToggleChildren = () => {
    this.setState(state => ({ childrenExpanded: !state.childrenExpanded }));
  };

  handleReplyChange = (e) => {
    this.setState({ replyText: e.target.value });
  };

  handleReplyKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.handleSubmit();
    }
    if (e.key === 'Escape') {
      this.setState({ showReplyInput: false, replyText: '' });
    }
  };

  handleSubmit = () => {
    const { reply, onReplySubmit } = this.props;
    const { replyText } = this.state;

    if (replyText.trim().length === 0 || this.state.submitting) return;

    this.setState({ submitting: true });

    const acct = reply.account.acct;
    let text = replyText;
    if (!text.includes(`@${acct}`)) {
      text = `@${acct} ${text}`;
    }

    onReplySubmit(reply.id, text, reply.visibility).then(() => {
      this.setState({ replyText: '', submitting: false, showReplyInput: false });
    }).catch(() => {
      this.setState({ submitting: false });
    });
  };

  render() {
    const { reply, depth, currentAccount, onReplySubmit, intl } = this.props;
    const { showReplyInput, replyText, submitting, childrenExpanded } = this.state;
    const account = reply.account;
    const avatarSize = depth === 0 ? 28 : 24;
    const childCount = reply.children ? reply.children.length : 0;
    const totalDescendants = countDescendants(reply);

    return (
      <div className={`status-replies__item status-replies__item--depth-${Math.min(depth, MAX_DEPTH)}`}>
        <div className='status-replies__item__main'>
          <Link to={`/@${account.acct}`} className='status-replies__item__avatar'>
            <img src={account.avatar} alt='' width={avatarSize} height={avatarSize} />
          </Link>
          <div className='status-replies__item__content'>
            <div className='status-replies__item__header'>
              <Link to={`/@${account.acct}`} className='status-replies__item__name'>
                {account.display_name || account.username}
              </Link>
              <span className='status-replies__item__acct'>@{account.acct}</span>
              <span className='status-replies__item__dot'>&middot;</span>
              <Link to={`/@${account.acct}/${reply.id}`} className='status-replies__item__time'>
                <RelativeTimestamp timestamp={reply.created_at} />
              </Link>
            </div>
            <div
              className='status-replies__item__text'
              dangerouslySetInnerHTML={{ __html: reply.content }}
            />
            <div className='status-replies__item__actions'>
              {currentAccount && (
                <button onClick={this.handleToggleReply}>
                  {intl.formatMessage(messages.reply)}
                </button>
              )}
              {childCount > 0 && (
                <button onClick={this.handleToggleChildren} className='status-replies__item__actions__child-count'>
                  {childrenExpanded ? (
                    <FormattedMessage id='status.hide_replies' defaultMessage='Hide replies' />
                  ) : (
                    <FormattedMessage
                      id='status.child_replies_count'
                      defaultMessage='{count, plural, one {# reply} other {# replies}}'
                      values={{ count: totalDescendants }}
                    />
                  )}
                </button>
              )}
            </div>
            {showReplyInput && (
              <div className='status-replies__item__inline-reply'>
                <div className='status-replies__item__inline-reply__input-wrapper'>
                  <input
                    type='text'
                    placeholder={intl.formatMessage(messages.replyPlaceholder)}
                    value={replyText}
                    onChange={this.handleReplyChange}
                    onKeyDown={this.handleReplyKeyDown}
                    disabled={submitting}
                    autoFocus
                  />
                  {replyText.length > 0 && (
                    <IconButton
                      icon='send'
                      iconComponent={ArrowIcon}
                      title={intl.formatMessage(messages.send)}
                      onClick={this.handleSubmit}
                      disabled={submitting || replyText.trim().length === 0}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {childCount > 0 && childrenExpanded && (
          <div className='status-replies__item__nested'>
            {reply.children.map(child => (
              <ReplyItem
                key={child.id}
                reply={child}
                depth={depth + 1}
                currentAccount={currentAccount}
                onReplySubmit={onReplySubmit}
                intl={intl}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
}

class StatusReplies extends PureComponent {
  static propTypes = {
    statusId: PropTypes.string.isRequired,
    statusAcct: PropTypes.string.isRequired,
    statusVisibility: PropTypes.string,
    repliesCount: PropTypes.number,
    currentAccount: ImmutablePropTypes.map,
    dispatch: PropTypes.func.isRequired,
    intl: PropTypes.object.isRequired,
  };

  static defaultProps = {
    repliesCount: 0,
    statusVisibility: 'public',
  };

  state = {
    expanded: true,
    loading: false,
    replies: [],
    replyText: '',
    submitting: false,
  };

  componentDidMount() {
    if (this.props.repliesCount > 0) {
      this.fetchReplies();
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.repliesCount === 0 && this.props.repliesCount > 0 && this.state.replies.length === 0) {
      this.fetchReplies();
    }
  }

  fetchReplies = () => {
    const { statusId, dispatch } = this.props;

    this.setState({ loading: true });

    api().get(`/api/v1/statuses/${statusId}/context`).then(response => {
      const descendants = response.data.descendants || [];

      // Import statuses to Redux store
      dispatch(importFetchedStatuses(descendants));

      // Build recursive reply tree
      const tree = buildReplyTree(descendants, statusId);

      this.setState({
        loading: false,
        replies: tree,
      });
    }).catch(() => {
      this.setState({ loading: false });
    });
  };

  handleReplyChange = (e) => {
    this.setState({ replyText: e.target.value });
  };

  handleReplyKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.handleReplySubmit();
    }
  };

  handleReplySubmit = () => {
    const { statusId, statusAcct, statusVisibility, dispatch } = this.props;
    const { replyText } = this.state;

    if (replyText.trim().length === 0 || this.state.submitting) {
      return;
    }

    this.setState({ submitting: true });

    let text = replyText;
    if (!text.includes(`@${statusAcct}`)) {
      text = `@${statusAcct} ${text}`;
    }

    api().post('/api/v1/statuses', {
      status: text,
      in_reply_to_id: statusId,
      visibility: statusVisibility,
    }).then(response => {
      this.setState({ replyText: '', submitting: false });
      dispatch(importFetchedStatuses([response.data]));
      this.fetchReplies();
    }).catch(error => {
      this.setState({ submitting: false });
      dispatch(showAlertForError(error));
    });
  };

  // Handler for inline reply on any comment in the tree
  handleInlineReplySubmit = (inReplyToId, text, visibility) => {
    const { dispatch } = this.props;

    return api().post('/api/v1/statuses', {
      status: text,
      in_reply_to_id: inReplyToId,
      visibility: visibility || this.props.statusVisibility,
    }).then(response => {
      dispatch(importFetchedStatuses([response.data]));
      this.fetchReplies();
    }).catch(error => {
      dispatch(showAlertForError(error));
      throw error;
    });
  };

  render() {
    const { repliesCount, currentAccount, intl, statusId } = this.props;
    const { loading, replies, replyText, submitting } = this.state;

    // Don't show anything if no replies and not signed in
    if (repliesCount === 0 && !currentAccount) {
      return null;
    }

    return (
      <div className='status-replies'>
        <div className='status-replies__content'>
          {loading ? (
            <div className='status-replies__loading'>
              <FormattedMessage id='status.loading_replies' defaultMessage='Loading replies...' />
            </div>
          ) : (
            <>
              {replies.length > 0 && (
                <div className='status-replies__list'>
                  {replies.map(reply => (
                    <ReplyItem
                      key={reply.id}
                      reply={reply}
                      depth={0}
                      currentAccount={currentAccount}
                      onReplySubmit={this.handleInlineReplySubmit}
                      intl={intl}
                    />
                  ))}
                </div>
              )}
              {repliesCount > replies.length && replies.length > 0 && (
                <Link
                  to={`/statuses/${statusId}`}
                  className='status-replies__view-all'
                >
                  <FormattedMessage
                    id='status.view_all_replies'
                    defaultMessage='View all {count} replies'
                    values={{ count: repliesCount }}
                  />
                </Link>
              )}
            </>
          )}
        </div>

        {currentAccount && (
          <div className='status-replies__quick-reply'>
            <div className='status-replies__quick-reply__avatar'>
              <img src={currentAccount.get('avatar')} alt='' width={28} height={28} />
            </div>
            <div className='status-replies__quick-reply__input-wrapper'>
              <input
                type='text'
                placeholder={intl.formatMessage(messages.replyPlaceholder)}
                value={replyText}
                onChange={this.handleReplyChange}
                onKeyDown={this.handleReplyKeyDown}
                disabled={submitting}
              />
              {replyText.length > 0 && (
                <IconButton
                  icon='send'
                  iconComponent={ArrowIcon}
                  title={intl.formatMessage(messages.send)}
                  onClick={this.handleReplySubmit}
                  disabled={submitting || replyText.trim().length === 0}
                />
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default connect(mapStateToProps)(injectIntl(StatusReplies));
