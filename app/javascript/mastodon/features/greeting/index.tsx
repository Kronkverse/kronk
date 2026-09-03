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

// Kronk greeting — the welcome page shown on the first fresh app open
// of every session (Tal 2026-08-31: "when a page is first navigated to
// (or opened each new session) ... simple, clear, kronk infographics,
// with some big options floating, such as Post, Feed, Share").
// Route: /welcome. The initial-load redirect in features/ui/index.jsx
// sends signed-in users here on session start if the session flag
// isn't set.
//
// Three doors, and nothing else (Tal 2026-09-03: icons, larger cards,
// "make it clear that there's three options to go from here"). Each is
// a big square card — icon over label — laid out three-across at every
// width, phone included: the row IS the message, so it should read as
// three at a glance rather than reflowing into a stack that has to be
// counted. See the SCSS for how the cards stay square on a 320px
// screen.
//
// The quiet "Skip to hub" line is gone (Tal 2026-09-03). It existed
// because the greeting used to render bare, with no chrome and so no
// way out except a CTA. The Frame came back on 2026-09-03 (#1674), so
// the wordmark, the nav and the Ж menu are all present and the escape
// hatch is redundant — it was only ever competing with the three
// choices it sat under.
//
// Chrome: the greeting renders inside the Frame like every other
// space, and is a declared core space
// (`config/korners/welcome.yaml`), so the title comes from the
// manifest via <SpaceHeader>. See docs/korners/korner_standard.md
// L11/L12.
//
// Session flag: sessionStorage 'kronk:greeted' — set whenever the
// caller leaves via any affordance so the greeting doesn't re-appear
// mid-session.

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

interface DoorProps {
  label: string;
  // Supplementary hint ("Say something"). Not rendered as text — a
  // square card that has to hold a second line at 86px wide on a
  // phone stops being an icon card. It rides as `title` so the
  // pointer gets it; the accessible name stays the visible label,
  // since element content wins over `title`.
  hint: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  iconId: string;
  onClick: () => void;
}

const Door: React.FC<DoorProps> = ({ label, hint, icon, iconId, onClick }) => (
  <button
    type='button'
    className='kronk-greeting__door'
    onClick={onClick}
    title={hint}
  >
    <span className='kronk-greeting__door-glyph' aria-hidden='true'>
      <Icon id={iconId} icon={icon} />
    </span>
    <span className='kronk-greeting__door-label'>{label}</span>
  </button>
);

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
          <div className='kronk-greeting__doors'>
            <Door
              label={intl.formatMessage(messages.post)}
              hint={intl.formatMessage(messages.postSub)}
              icon={AddIcon}
              iconId='post'
              onClick={goCompose}
            />
            <Door
              label={intl.formatMessage(messages.feed)}
              hint={intl.formatMessage(messages.feedSub)}
              icon={HomeIcon}
              iconId='feed'
              onClick={goHome}
            />
            <Door
              label={intl.formatMessage(messages.invite)}
              hint={intl.formatMessage(messages.inviteSub)}
              icon={PersonAddIcon}
              iconId='invite'
              onClick={openShare}
            />
          </div>
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
