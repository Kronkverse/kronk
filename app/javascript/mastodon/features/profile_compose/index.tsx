import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';

import Column from 'mastodon/components/column';

// Profile Composer at /hub/profile/compose. Step 2 of the composer
// rollout — this ships the route + three-pane skeleton + top-bar
// chrome. The palette (left), live canvas (center), and inspector
// (right) fill in during steps 3, 4, and 5.
//
// Same design tokens + starfield backdrop as the profile page —
// composing your profile should feel like you're still IN your
// profile, just in editing mode.

const messages = defineMessages({
  title: { id: 'profile_compose.title', defaultMessage: 'Compose your profile' },
  crumbLead: { id: 'profile_compose.crumb.lead', defaultMessage: 'Profile' },
  crumbCurrent: { id: 'profile_compose.crumb.current', defaultMessage: 'Compose' },
  savedJustNow: { id: 'profile_compose.saved.just_now', defaultMessage: 'Saved just now' },
  preview: { id: 'profile_compose.preview_as_visitor', defaultMessage: 'Preview as visitor' },
  done: { id: 'profile_compose.done', defaultMessage: 'Done' },

  paletteHeading: { id: 'profile_compose.palette.heading', defaultMessage: 'Cards' },
  paletteEmpty: { id: 'profile_compose.palette.empty', defaultMessage: 'Palette lands in step 3.' },
  canvasHeading: { id: 'profile_compose.canvas.heading', defaultMessage: 'Live canvas' },
  canvasEmpty: { id: 'profile_compose.canvas.empty', defaultMessage: 'Canvas lands in step 4.' },
  inspectorHeading: { id: 'profile_compose.inspector.heading', defaultMessage: 'Inspector' },
  inspectorEmpty: { id: 'profile_compose.inspector.empty', defaultMessage: 'Select a card to edit — inspector lands in step 5.' },
});

export const ProfileCompose = () => {
  const intl = useIntl();

  return (
    <Column bindToDocument label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>

      <div className='scrollable kcompose'>
        <header className='kcompose__topbar'>
          <span className='kcompose__wordmark'>ӁЯѺƝ₭</span>
          <span className='kcompose__crumb'>
            <FormattedMessage {...messages.crumbLead} />
            {' · '}
            <b>
              <FormattedMessage {...messages.crumbCurrent} />
            </b>
          </span>

          <div className='kcompose__topbar-right'>
            {/* Placeholder — real save state indicator lands with the
                inspector step. */}
            <span className='kcompose__saved' aria-live='polite'>
              <FormattedMessage {...messages.savedJustNow} />
            </span>
            <button type='button' className='kcompose__btn' disabled>
              <FormattedMessage {...messages.preview} />
            </button>
            <a href='/@me' className='kcompose__btn kcompose__btn--primary'>
              <FormattedMessage {...messages.done} />
            </a>
          </div>
        </header>

        <div className='kcompose__panes'>
          <aside className='kcompose__pane kcompose__pane--left'>
            <p className='kcompose__pane-h'>
              <FormattedMessage {...messages.paletteHeading} />
            </p>
            <p className='kcompose__pane-sub'>
              <FormattedMessage {...messages.paletteEmpty} />
            </p>
          </aside>

          <main className='kcompose__pane kcompose__pane--center'>
            <p className='kcompose__pane-h'>
              <FormattedMessage {...messages.canvasHeading} />
            </p>
            <p className='kcompose__pane-sub'>
              <FormattedMessage {...messages.canvasEmpty} />
            </p>
          </main>

          <aside className='kcompose__pane kcompose__pane--right'>
            <p className='kcompose__pane-h'>
              <FormattedMessage {...messages.inspectorHeading} />
            </p>
            <p className='kcompose__pane-sub'>
              <FormattedMessage {...messages.inspectorEmpty} />
            </p>
          </aside>
        </div>
      </div>
    </Column>
  );
};

export default ProfileCompose;
