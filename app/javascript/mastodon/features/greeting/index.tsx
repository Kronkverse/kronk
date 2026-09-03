import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import HomeIcon from '@/material-icons/400-24px/home.svg?react';
import PersonAddIcon from '@/material-icons/400-24px/person_add.svg?react';
import { Icon } from 'mastodon/components/icon';
import { ShareSheet } from 'mastodon/components/share_sheet';
import { SpaceHeader } from 'mastodon/components/space_header';
import { Stage } from 'mastodon/components/stage';
import { useKorner } from 'mastodon/hooks/useKorner';

// Kronk greeting — the spare welcome page shown on the first fresh
// app open of every session (Tal 2026-08-31: "when a page is first
// navigated to (or opened each new session) ... simple, clear, kronk
// infographics, with some big options floating, such as Post, Feed,
// Share"). Route: /welcome. The initial-load redirect in
// features/ui/index.jsx sends signed-in users here on session start
// if the session flag isn't set.
//
// Three big CTAs — Post (opens composer), Feed (routes to /home),
// Invite (opens ShareSheet against a "Join me on Kronk" payload).
// A quiet dismiss line at the bottom skips straight to /hub.
//
// Chrome (Tal 2026-09-03): the greeting renders inside the Frame like
// every other space. It spent 2026-08-31 → 09-01 as a bare
// full-viewport surface (`body.layout-bare` hid the top band, right
// rail, korner sidebar and Ж menu) and drifted from the rest of the
// app in the process — a hand-rolled title, a bespoke card species
// and its own background wash. It is now a declared core space
// (`config/korners/welcome.yaml`) sitting in a <Stage>, so the title
// comes from the manifest via <SpaceHeader> and the Frame provides
// the chrome. See docs/korners/korner_standard.md L11/L12.
//
// Session flag: sessionStorage 'kronk:greeted' — set whenever the
// caller leaves via any affordance so the greeting doesn't
// re-appear mid-session.

const SESSION_FLAG = 'kronk:greeted';

const messages = defineMessages({
  salutMorning: {
    id: 'greeting.salut.morning',
    defaultMessage: 'Good morning',
  },
  salutAfternoon: {
    id: 'greeting.salut.afternoon',
    defaultMessage: 'Good afternoon',
  },
  salutEvening: {
    id: 'greeting.salut.evening',
    defaultMessage: 'Good evening',
  },
  post: { id: 'greeting.post', defaultMessage: 'Post' },
  postSub: { id: 'greeting.post_sub', defaultMessage: 'Say something' },
  feed: { id: 'greeting.feed', defaultMessage: 'Feed' },
  feedSub: {
    id: 'greeting.feed_sub',
    defaultMessage: 'What’s happening',
  },
  invite: { id: 'greeting.invite', defaultMessage: 'Invite' },
  inviteSub: {
    id: 'greeting.invite_sub',
    defaultMessage: 'Bring a friend',
  },
  skipToHub: {
    id: 'greeting.skip',
    defaultMessage: 'Skip to hub',
  },
  inviteTitle: {
    id: 'greeting.invite_title',
    defaultMessage: 'Join me on Kronk',
  },
  // Fallback only — the real title comes from the manifest via
  // <SpaceHeader>. This covers the sub-second window before the korner
  // registry resolves, for <title> and the Stage's aria-label. Every
  // other space title on Kronk works this way (cf. settings_hub).
  title: { id: 'greeting.title', defaultMessage: 'Kronk' },
});

const salutFor = (hour: number) => {
  if (hour < 12) return messages.salutMorning;
  if (hour < 18) return messages.salutAfternoon;
  return messages.salutEvening;
};

const markGreeted = () => {
  try {
    window.sessionStorage.setItem(SESSION_FLAG, 'yes');
  } catch {
    // Ignore storage failures — the flag is a UX cache, not a
    // correctness guarantee. Worst case: greeting shows again on
    // next route change, which is a mild annoyance not a break.
  }
};

export const Greeting: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const [shareOpen, setShareOpen] = useState(false);

  const welcomeSpace = useKorner('welcome');
  const title = welcomeSpace?.name ?? intl.formatMessage(messages.title);

  const salut = useMemo(
    () => intl.formatMessage(salutFor(new Date().getHours())),
    [intl],
  );

  const inviteUrl = useMemo(() => window.location.origin, []);
  const inviteTitle = intl.formatMessage(messages.inviteTitle);

  const goHome = useCallback(() => {
    markGreeted();
    history.push('/home');
  }, [history]);

  const goCompose = useCallback(() => {
    markGreeted();
    // /publish is Mastodon's compose route — feed context, opens
    // the composer inline. Kept consistent with the Ж-menu compose
    // affordance so the greeting's Post button drops the caller
    // into the same shape they'd otherwise reach via the
    // floating menu.
    history.push('/publish');
  }, [history]);

  const openShare = useCallback(() => {
    markGreeted();
    setShareOpen(true);
  }, []);
  const closeShare = useCallback(() => {
    setShareOpen(false);
  }, []);

  const skipToHub = useCallback(() => {
    markGreeted();
    history.push('/hub');
  }, [history]);

  return (
    <Stage label={title}>
      <Helmet>
        <title>{title}</title>
      </Helmet>

      {/* Title + salutation. `/welcome` is a core space (manifest at
          config/korners/welcome.yaml, `core: true`), so
          <AutoSpaceHeader> skips it and we render <SpaceHeader>
          directly with our own slug — the same shape settings_hub
          uses. The name comes from the manifest; only the subtitle is
          ours, because a time-of-day salutation can't be static copy. */}
      <SpaceHeader slug='welcome' tagline={salut} />

      <div className='stage-column'>
        <div className='stage-column__inner kronk-greeting'>
          <div className='kronk-greeting__ctas'>
            <button
              type='button'
              className='kronk-greeting__cta kronk-greeting__cta--primary'
              onClick={goCompose}
            >
              <span className='kronk-greeting__cta-glyph' aria-hidden='true'>
                <Icon id='post' icon={AddIcon} />
              </span>
              <span className='kronk-greeting__cta-body'>
                <span className='kronk-greeting__cta-title'>
                  {intl.formatMessage(messages.post)}
                </span>
                <span className='kronk-greeting__cta-desc'>
                  {intl.formatMessage(messages.postSub)}
                </span>
              </span>
            </button>

            <button
              type='button'
              className='kronk-greeting__cta'
              onClick={goHome}
            >
              <span className='kronk-greeting__cta-glyph' aria-hidden='true'>
                <Icon id='feed' icon={HomeIcon} />
              </span>
              <span className='kronk-greeting__cta-body'>
                <span className='kronk-greeting__cta-title'>
                  {intl.formatMessage(messages.feed)}
                </span>
                <span className='kronk-greeting__cta-desc'>
                  {intl.formatMessage(messages.feedSub)}
                </span>
              </span>
            </button>

            <button
              type='button'
              className='kronk-greeting__cta'
              onClick={openShare}
            >
              <span className='kronk-greeting__cta-glyph' aria-hidden='true'>
                <Icon id='invite' icon={PersonAddIcon} />
              </span>
              <span className='kronk-greeting__cta-body'>
                <span className='kronk-greeting__cta-title'>
                  {intl.formatMessage(messages.invite)}
                </span>
                <span className='kronk-greeting__cta-desc'>
                  {intl.formatMessage(messages.inviteSub)}
                </span>
              </span>
            </button>
          </div>

          <button
            type='button'
            className='kronk-greeting__dismiss'
            onClick={skipToHub}
          >
            {intl.formatMessage(messages.skipToHub)}
          </button>
        </div>
      </div>

      {shareOpen && (
        <ShareSheet
          open={shareOpen}
          onClose={closeShare}
          url={inviteUrl}
          title={inviteTitle}
        />
      )}
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export -- async-components.js expects default exports for routed feature entries
export default Greeting;
