import PropTypes from 'prop-types';

import { defineMessages, injectIntl } from 'react-intl';

import classNames from 'classnames';

import ImmutablePropTypes from 'react-immutable-proptypes';
import ImmutablePureComponent from 'react-immutable-pure-component';
import { connect } from 'react-redux';

import ReactSwipeableViews from 'react-swipeable-views';

import ChevronLeftIcon from '@/material-icons/400-24px/chevron_left.svg?react';
import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import FitScreenIcon from '@/material-icons/400-24px/fit_screen.svg?react';
import TagIcon from '@/material-icons/400-24px/tag.svg?react';
import ActualSizeIcon from '@/svg-icons/actual_size.svg?react';
import { openModal } from 'mastodon/actions/modal';
import { apiGetMediaTags } from 'mastodon/api/media_tags';
import { getAverageFromBlurhash } from 'mastodon/blurhash';
import { GIFV } from 'mastodon/components/gifv';
import { Icon }  from 'mastodon/components/icon';
import { IconButton } from 'mastodon/components/icon_button';
import { Footer } from 'mastodon/features/picture_in_picture/components/footer';
import { Video } from 'mastodon/features/video';
import { disableSwiping } from 'mastodon/initial_state';

import { ZoomableImage } from './zoomable_image';

const messages = defineMessages({
  close: { id: 'lightbox.close', defaultMessage: 'Close' },
  previous: { id: 'lightbox.previous', defaultMessage: 'Previous' },
  next: { id: 'lightbox.next', defaultMessage: 'Next' },
  zoomIn: { id: 'lightbox.zoom_in', defaultMessage: 'Zoom to actual size' },
  zoomOut: { id: 'lightbox.zoom_out', defaultMessage: 'Zoom to fit' },
  tagYourself: { id: 'lightbox.tag_people', defaultMessage: 'Tag people' },
});

class MediaModal extends ImmutablePureComponent {

  static propTypes = {
    media: ImmutablePropTypes.list.isRequired,
    statusId: PropTypes.string,
    lang: PropTypes.string,
    index: PropTypes.number.isRequired,
    onClose: PropTypes.func.isRequired,
    intl: PropTypes.object.isRequired,
    onChangeBackgroundColor: PropTypes.func.isRequired,
    dispatch: PropTypes.func.isRequired,
    currentTime: PropTypes.number,
    autoPlay: PropTypes.bool,
    volume: PropTypes.number,
  };

  state = {
    index: null,
    navigationHidden: false,
    zoomedIn: false,
    mediaTags: {},
  };

  handleZoomClick = () => {
    this.setState(prevState => ({
      zoomedIn: !prevState.zoomedIn,
    }));
  };

  handleZoomChange = (zoomedIn) => {
    this.setState({
      zoomedIn,
    });
  };

  handleSwipe = (index) => {
    this.setState({
      index: index % this.props.media.size,
      zoomedIn: false,
    });
  };

  handleTransitionEnd = () => {
    this.setState({
      zoomedIn: false,
    });
  };

  handleNextClick = () => {
    this.setState({
      index: (this.getIndex() + 1) % this.props.media.size,
      zoomedIn: false,
    });
  };

  handlePrevClick = () => {
    this.setState({
      index: (this.props.media.size + this.getIndex() - 1) % this.props.media.size,
      zoomedIn: false,
    });
  };

  handleChangeIndex = (e) => {
    const index = Number(e.currentTarget.getAttribute('data-index'));

    this.setState({
      index: index % this.props.media.size,
      zoomedIn: false,
    });
  };

  handleKeyDown = (e) => {
    switch(e.key) {
    case 'ArrowLeft':
      this.handlePrevClick();
      e.preventDefault();
      e.stopPropagation();
      break;
    case 'ArrowRight':
      this.handleNextClick();
      e.preventDefault();
      e.stopPropagation();
      break;
    }
  };

  componentDidMount () {
    window.addEventListener('keydown', this.handleKeyDown, false);

    this._sendBackgroundColor();
    this._fetchTagsForCurrent();
  }

  componentDidUpdate (prevProps, prevState) {
    const index = this.getIndex();
    const prevIndex = prevState.index !== null ? prevState.index : this.props.index;

    if (prevIndex !== index) {
      this._sendBackgroundColor();
      this._fetchTagsForCurrent();
    }
  }

  _fetchTagsForCurrent () {
    const { media } = this.props;
    const index = this.getIndex();
    const current = media.get(index);
    if (!current) return;
    const type = current.get('type');
    if (type !== 'image' && type !== 'gifv' && type !== 'video') return;
    const mediaId = current.get('id');
    if (!mediaId) return;
    if (this.state.mediaTags[mediaId] !== undefined) return;
    apiGetMediaTags(mediaId)
      .then(tags => {
        this.setState(prev => ({ mediaTags: { ...prev.mediaTags, [mediaId]: tags } }));
      })
      .catch(() => {
        this.setState(prev => ({ mediaTags: { ...prev.mediaTags, [mediaId]: [] } }));
      });
  }

  _sendBackgroundColor () {
    const { media, onChangeBackgroundColor } = this.props;
    const index = this.getIndex();
    const blurhash = media.getIn([index, 'blurhash']);

    if (blurhash) {
      const backgroundColor = getAverageFromBlurhash(blurhash);
      onChangeBackgroundColor(backgroundColor);
    }
  }

  componentWillUnmount () {
    window.removeEventListener('keydown', this.handleKeyDown);

    this.props.onChangeBackgroundColor(null);
  }

  getIndex () {
    return this.state.index !== null ? this.state.index : this.props.index;
  }

  handleToggleNavigation = () => {
    this.setState(prevState => ({
      navigationHidden: !prevState.navigationHidden,
    }));
  };

  handleTagYourself = () => {
    const { media, dispatch } = this.props;
    const index = this.getIndex();
    const current = media.get(index);
    const mediaId = current.get('id');
    const previewUrl = current.get('preview_url') || current.get('url');
    dispatch(openModal({ modalType: 'SELF_TAG', modalProps: { mediaId, previewUrl } }));
  };

  setRef = c => {
    this.setState({
      viewportWidth: c?.clientWidth,
      viewportHeight: c?.clientHeight,
    });
  };

  render () {
    const { media, statusId, lang, intl, onClose } = this.props;
    const { navigationHidden, zoomedIn, viewportWidth, viewportHeight, mediaTags } = this.state;

    const index = this.getIndex();

    const leftNav  = media.size > 1 && <button tabIndex={0} className='media-modal__nav media-modal__nav--prev' onClick={this.handlePrevClick} aria-label={intl.formatMessage(messages.previous)}><Icon id='chevron-left' icon={ChevronLeftIcon} /></button>;
    const rightNav = media.size > 1 && <button tabIndex={0} className='media-modal__nav  media-modal__nav--next' onClick={this.handleNextClick} aria-label={intl.formatMessage(messages.next)}><Icon id='chevron-right' icon={ChevronRightIcon} /></button>;

    const content = media.map((image, idx) => {
      const width  = image.getIn(['meta', 'original', 'width']) || null;
      const height = image.getIn(['meta', 'original', 'height']) || null;
      const description = image.getIn(['translation', 'description']) || image.get('description');

      if (image.get('type') === 'image') {
        return (
          <ZoomableImage
            src={image.get('url')}
            blurhash={image.get('blurhash')}
            width={width}
            height={height}
            alt={description}
            lang={lang}
            key={image.get('url')}
            onClick={this.handleToggleNavigation}
            onDoubleClick={this.handleZoomClick}
            onClose={onClose}
            onZoomChange={this.handleZoomChange}
            zoomedIn={zoomedIn && idx === index}
          />
        );
      } else if (image.get('type') === 'video') {
        const { currentTime, autoPlay, volume } = this.props;

        return (
          <Video
            preview={image.get('preview_url')}
            blurhash={image.get('blurhash')}
            src={image.get('url')}
            frameRate={image.getIn(['meta', 'original', 'frame_rate'])}
            aspectRatio={`${image.getIn(['meta', 'original', 'width'])} / ${image.getIn(['meta', 'original', 'height'])}`}
            startTime={currentTime || 0}
            startPlaying={autoPlay || false}
            startVolume={volume || 1}
            onCloseVideo={onClose}
            detailed
            alt={description}
            lang={lang}
            key={image.get('url')}
          />
        );
      } else if (image.get('type') === 'gifv') {
        return (
          <GIFV
            src={image.get('url')}
            key={image.get('url')}
            alt={description}
            lang={lang}
            onClick={this.toggleNavigation}
          />
        );
      }

      return null;
    }).toArray();

    // you can't use 100vh, because the viewport height is taller
    // than the visible part of the document in some mobile
    // browsers when it's address bar is visible.
    // https://developers.google.com/web/updates/2016/12/url-bar-resizing
    const swipeableViewsStyle = {
      width: '100%',
      height: '100%',
    };

    const containerStyle = {
      alignItems: 'center', // center vertically
    };

    const navigationClassName = classNames('media-modal__navigation', {
      'media-modal__navigation--hidden': navigationHidden,
    });

    let pagination;

    if (media.size > 1) {
      pagination = media.map((item, i) => (
        <button key={i} className={classNames('media-modal__page-dot', { active: i === index })} data-index={i} onClick={this.handleChangeIndex}>
          {i + 1}
        </button>
      ));
    }

    const currentMedia = media.get(index);
    const mediaType = currentMedia.get('type');
    const zoomable = mediaType === 'image' && (currentMedia.getIn(['meta', 'original', 'width']) > viewportWidth || currentMedia.getIn(['meta', 'original', 'height']) > viewportHeight);
    const taggable = mediaType !== 'audio' && mediaType !== 'unknown';

    const currentMediaId = currentMedia.get('id');
    const currentTags = currentMediaId ? mediaTags[currentMediaId] : undefined;
    const taggedNames = currentTags && currentTags.length > 0
      ? currentTags.map(tag => tag.account?.display_name || tag.account?.username).filter(Boolean).join(', ')
      : null;

    return (
      <div className='modal-root__modal media-modal' ref={this.setRef}>
        <div className='media-modal__closer' role='presentation' onClick={onClose}>
          <ReactSwipeableViews
            style={swipeableViewsStyle}
            containerStyle={containerStyle}
            onChangeIndex={this.handleSwipe}
            onTransitionEnd={this.handleTransitionEnd}
            index={index}
            disabled={disableSwiping || zoomedIn}
          >
            {content}
          </ReactSwipeableViews>
        </div>

        <div className={navigationClassName}>
          <div className='media-modal__buttons'>
            {zoomable && <IconButton title={intl.formatMessage(zoomedIn ? messages.zoomOut : messages.zoomIn)} iconComponent={zoomedIn ? FitScreenIcon : ActualSizeIcon} onClick={this.handleZoomClick} />}
            {taggable && <IconButton title={intl.formatMessage(messages.tagYourself)} icon='tag' iconComponent={TagIcon} onClick={this.handleTagYourself} />}
            <IconButton title={intl.formatMessage(messages.close)} icon='times' iconComponent={CloseIcon} onClick={onClose} />
          </div>

          {leftNav}
          {rightNav}

          <div className='media-modal__overlay'>
            {pagination && <ul className='media-modal__pagination'>{pagination}</ul>}
            {taggedNames && <p className='media-modal__tagged-names'>With: {taggedNames}</p>}
            {statusId && <Footer statusId={statusId} withOpenButton onClose={onClose} />}
          </div>
        </div>
      </div>
    );
  }

}

export default connect()(injectIntl(MediaModal));
