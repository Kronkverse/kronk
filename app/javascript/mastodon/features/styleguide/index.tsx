import { useState } from 'react';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import ChatBubbleIcon from '@/material-icons/400-24px/chat_bubble.svg?react';
import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import ChevronLeftIcon from '@/material-icons/400-24px/chevron_left.svg?react';
import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import ContentCopyIcon from '@/material-icons/400-24px/content_copy.svg?react';
import DeleteIcon from '@/material-icons/400-24px/delete.svg?react';
import FavoriteIcon from '@/material-icons/400-24px/favorite.svg?react';
import HourglassIcon from '@/material-icons/400-24px/hourglass.svg?react';
import PersonAddIcon from '@/material-icons/400-24px/person_add.svg?react';
import RepeatIcon from '@/material-icons/400-24px/repeat.svg?react';
import SearchIcon from '@/material-icons/400-24px/search.svg?react';
import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import ShareIcon from '@/material-icons/400-24px/share.svg?react';
import SpiralIcon from '@/material-icons/400-24px/spiral.svg?react';
import { Alert } from 'mastodon/components/alert';
import { BackToKorner } from 'mastodon/components/back_to_korner';
import { Column } from 'mastodon/components/column';
import { ColumnBackButton } from 'mastodon/components/column_back_button';
import { EmptyState } from 'mastodon/components/empty_state';
import { Icon } from 'mastodon/components/icon';
import { KornerPill } from 'mastodon/components/korner_pill';
import { KornerVisibilityPicker } from 'mastodon/components/korner_visibility_picker';
import { LoadingState } from 'mastodon/components/loading_state';
import { StatusAlbuttsCard } from 'mastodon/components/status_albutts_card';
import { StatusBoothCard } from 'mastodon/components/status_booth_card';
import { StatusEventCard } from 'mastodon/components/status_event_card';
import { StatusKommonsCard } from 'mastodon/components/status_kommons_card';
import { StatusKuestionsCard } from 'mastodon/components/status_kuestions_card';
import { StatusTrekCard } from 'mastodon/components/status_trek_card';
import { StatusWachuneedCard } from 'mastodon/components/status_wachuneed_card';
import { SettingsRadioCards } from 'mastodon/features/settings/radio_cards';
import { SettingsSection } from 'mastodon/features/settings/section';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// Living style guide — the source of truth for what every Kronk token
// looks like when applied. Change tokens.yaml, refresh, see the
// result. Includes: palette, semantic surfaces, typography, radius
// scale, elevation, motion, and representative buttons/cards/chips
// using each.

// ── Small stateful/hook-driven helpers for the primitive gallery ─
// Kept file-local so the main `StyleGuide` tree stays a flat JSX read.

const VisibilityPickerDemo: React.FC<{
  slug: string;
  initial?: string;
}> = ({ slug, initial = 'public' }) => {
  const [value, setValue] = useState(initial);
  return (
    <KornerVisibilityPicker slug={slug} value={value} onChange={setValue} />
  );
};

// Renders one korner icon in the icons grid. Wrapping the hook in a
// tiny component means the styleguide can iterate over slug strings
// without violating rules-of-hooks.
const KornerIconTile: React.FC<{ slug: string }> = ({ slug }) => {
  const KIcon = useKornerIcon(slug);
  return (
    <div className='styleguide__korner-icon'>
      <KIcon className='styleguide__korner-icon-glyph' />
      <code>{slug}</code>
    </div>
  );
};

// Non-core korner slugs — the manifests users actually browse into.
// `feed / hub / profile / settings / you` are core spaces, not
// korners, so they don't belong in a korners-icons grid.
const KORNER_SLUGS = [
  'albutts',
  'art',
  'booth',
  'huddle',
  'inflow',
  'kalendar',
  'klot',
  'kommons',
  'kommunity',
  'krew',
  'kuestions',
  'map',
  'martketplace',
  'moments',
  'nudges',
];

const swatches = [
  { name: 'purple-primary', var: '--kronk-purple-primary' },
  { name: 'purple-bright', var: '--kronk-purple-bright' },
  { name: 'purple-deep', var: '--kronk-purple-deep' },
  { name: 'purple-muted', var: '--kronk-purple-muted' },
  { name: 'purple-accent', var: '--kronk-purple-accent' },
];

const semantic = [
  { name: 'accent', var: '--accent' },
  { name: 'surface-primary', var: '--surface-primary' },
  { name: 'surface-elevated', var: '--surface-elevated' },
  { name: 'border-default', var: '--border-default' },
  { name: 'text-primary', var: '--text-primary' },
  { name: 'text-secondary', var: '--text-secondary' },
  { name: 'text-muted', var: '--text-muted' },
  { name: 'warning-red', var: '--warning-red' },
  { name: 'success-green', var: '--success-green' },
];

const radii = [
  {
    name: 'small',
    var: '--radius-small',
    use: 'chips, small icon buttons, focus rings',
  },
  {
    name: 'medium',
    var: '--radius-medium',
    use: 'cards, panels, dropdowns, sidebar tiles',
  },
  {
    name: 'large',
    var: '--radius-large',
    use: 'hero surfaces — top strip, sidebar, korner cards',
  },
  {
    name: 'round',
    var: '--radius-round',
    use: 'pills — HubSwitcher, tags, badges',
  },
];

const elevations = [
  {
    name: 'subtle',
    var: '--elevation-subtle',
    use: 'inline surfaces, subtle depth',
  },
  { name: 'card', var: '--elevation-card', use: 'floating cards, panels' },
  {
    name: 'floating',
    var: '--elevation-floating',
    use: 'top strip, sidebar, floating menus',
  },
  { name: 'menu', var: '--elevation-menu', use: 'Ж menu panel, modals' },
];

const motions = [
  {
    name: 'dur-fast',
    var: '--dur-fast',
    use: 'hover, focus, small state changes',
  },
  {
    name: 'dur-medium',
    var: '--dur-medium',
    use: 'panel opens, transitions between views',
  },
  {
    name: 'dur-slow',
    var: '--dur-slow',
    use: 'large transitions, page shifts',
  },
  { name: 'ease-out', var: '--ease-out', use: 'default deceleration' },
  { name: 'ease-in-out', var: '--ease-in-out', use: 'reversible motion' },
  { name: 'ease-spring', var: '--ease-spring', use: 'playful, springy motion' },
];

const fonts = [
  { name: 'display', var: '--font-display', sample: 'Kronk rebuild aesthetic' },
  {
    name: 'body',
    var: '--font-body',
    sample: 'The quick brown fox jumps over the lazy dog.',
  },
  { name: 'mono', var: '--font-mono', sample: 'const foo = "bar";' },
];

// Interactive demo of the settings kit — kept out of the main StyleGuide
// tree so it can hold its own useState for the radio-card selection.
type DemoAccess = 'open' | 'invite_only' | 'gated';

const SettingsKitDemo: React.FC = () => {
  const [value, setValue] = useState<DemoAccess>('invite_only');
  return (
    <SettingsSection heading='Access' hint='Who can join this Krew.'>
      <SettingsRadioCards<DemoAccess>
        name='styleguide-access'
        value={value}
        onChange={setValue}
        ariaLabel='Access'
        choices={[
          {
            key: 'open',
            label: 'Open',
            description: 'Anyone can join directly.',
          },
          {
            key: 'invite_only',
            label: 'Invite-only',
            description: 'People need an invite link to join.',
          },
          {
            key: 'gated',
            label: 'Requirement-gated',
            description: 'Add requirements below that people must meet.',
          },
        ]}
      />
    </SettingsSection>
  );
};

export const StyleGuide = () => (
  <Column bindToDocument label='Style guide'>
    <ColumnBackButton />

    <Helmet>
      <title>Kronk style guide</title>
    </Helmet>

    <div className='styleguide'>
      <header className='styleguide__hero'>
        <h1 className='styleguide__title'>Kronk aesthetic</h1>
        <p className='styleguide__intro'>
          Live values from <code>tokens.yaml</code>. Every surface in Kronk
          composes against these. Change the token; every consumer retunes.
        </p>
      </header>

      <section className='styleguide__section'>
        <h2 className='styleguide__section-title'>Palette</h2>
        <div className='styleguide__swatches'>
          {swatches.map((s) => (
            <div key={s.var} className='styleguide__swatch'>
              <div
                className='styleguide__swatch-chip'
                style={{ background: `var(${s.var})` }}
              />
              <div className='styleguide__swatch-meta'>
                <code>{s.name}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className='styleguide__section'>
        <h2 className='styleguide__section-title'>
          Semantic surfaces &amp; text
        </h2>
        <div className='styleguide__swatches'>
          {semantic.map((s) => (
            <div key={s.var} className='styleguide__swatch'>
              <div
                className='styleguide__swatch-chip'
                style={{ background: `var(${s.var})` }}
              />
              <div className='styleguide__swatch-meta'>
                <code>{s.name}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className='styleguide__section'>
        <h2 className='styleguide__section-title'>Typography</h2>
        {fonts.map((f) => (
          <div key={f.var} className='styleguide__font-row'>
            <code className='styleguide__font-name'>{f.name}</code>
            <span
              className='styleguide__font-sample'
              style={{ fontFamily: `var(${f.var})` }}
            >
              {f.sample}
            </span>
          </div>
        ))}
      </section>

      <section className='styleguide__section'>
        <h2 className='styleguide__section-title'>Radius</h2>
        <div className='styleguide__radii'>
          {radii.map((r) => (
            <div key={r.var} className='styleguide__radius'>
              <div
                className='styleguide__radius-box'
                style={{ borderRadius: `var(${r.var})` }}
              />
              <code>{r.name}</code>
              <p>{r.use}</p>
            </div>
          ))}
        </div>
      </section>

      <section className='styleguide__section'>
        <h2 className='styleguide__section-title'>Elevation</h2>
        <div className='styleguide__elevations'>
          {elevations.map((e) => (
            <div key={e.var} className='styleguide__elevation'>
              <div
                className='styleguide__elevation-box'
                style={{ boxShadow: `var(${e.var})` }}
              />
              <code>{e.name}</code>
              <p>{e.use}</p>
            </div>
          ))}
        </div>
      </section>

      <section className='styleguide__section'>
        <h2 className='styleguide__section-title'>Motion</h2>
        <div className='styleguide__motion'>
          {motions.map((m) => (
            <div key={m.var} className='styleguide__motion-row'>
              <code>{m.name}</code>
              <p>{m.use}</p>
            </div>
          ))}
        </div>
      </section>

      <section className='styleguide__section'>
        <h2 className='styleguide__section-title'>Components</h2>

        <h3 className='styleguide__subsection-title'>Buttons</h3>
        <div className='styleguide__row'>
          <button
            type='button'
            className='styleguide__btn styleguide__btn--primary'
          >
            Primary CTA
          </button>
          <button
            type='button'
            className='styleguide__btn styleguide__btn--secondary'
          >
            Secondary
          </button>
          <button
            type='button'
            className='styleguide__btn styleguide__btn--pill'
          >
            Pill
          </button>
          <button
            type='button'
            className='styleguide__btn styleguide__btn--danger'
          >
            Danger
          </button>
        </div>

        <h3 className='styleguide__subsection-title'>Card</h3>
        <div className='styleguide__card'>
          <h4>Card title</h4>
          <p>
            A card is a small elevated surface. Uses{' '}
            <code>--surface-elevated</code>,<code>--border-default</code>,{' '}
            <code>--radius-medium</code>, and
            <code>--elevation-card</code>.
          </p>
          <button
            type='button'
            className='styleguide__btn styleguide__btn--pill'
          >
            Action
          </button>
        </div>

        <h3 className='styleguide__subsection-title'>Pill row</h3>
        <div className='styleguide__pills'>
          <span className='styleguide__pill'>Kalendar</span>
          <span className='styleguide__pill styleguide__pill--active'>
            Kommons
          </span>
          <span className='styleguide__pill'>Booth</span>
          <span className='styleguide__pill'>Kuestions</span>
        </div>
      </section>

      <section className='styleguide__section'>
        <h2 className='styleguide__section-title'>Kronk primitives</h2>
        <p className='styleguide__section-intro'>
          Live renders of the shared visual primitives — the same components
          Kronk uses across every korner. Refine the SCSS and every consumer
          picks it up. Uses stub content so nothing hits Redux or the API;
          layouts and styles only.
        </p>

        <h3 className='styleguide__subsection-title'>
          Standard title (space-header)
        </h3>
        <div className='styleguide__primitive'>
          <header className='space-header' data-frame-header=''>
            <h1 className='space-header__title'>Kalendar</h1>
            <p className='space-header__tagline'>
              The year of Kronk, seen at a glance.
            </p>
          </header>
        </div>

        <h3 className='styleguide__subsection-title'>
          Detail title (korner-detail)
        </h3>
        <div className='styleguide__primitive'>
          <div className='korner-detail'>
            <h1 className='korner-detail__title'>
              <Icon
                id='spiral'
                icon={SpiralIcon}
                className='korner-detail__title-icon'
              />
              <span className='korner-detail__title-text'>Snowgum Skip</span>
            </h1>
            <p className='korner-detail__subtitle'>
              Friday · 23 October · 15:20 – 17:20
            </p>
          </div>
        </div>

        <h3 className='styleguide__subsection-title'>Back chip</h3>
        <div className='styleguide__primitive'>
          <BackToKorner href='#' label='All events' />
        </div>

        <h3 className='styleguide__subsection-title'>
          Rotator title (scope-title)
        </h3>
        <p className='styleguide__note'>
          The header rotator every korner mounts when the manifest sets
          <code>header.rotator: true</code> — <code>&lt;ScopeTitle&gt;</code>{' '}
          wraps <code>.space-header</code> with soft chevrons that step through
          the korner&rsquo;s views. Static render — the real one steps on tap
          and syncs with <code>&lt;FeedDrum&gt;</code>.
        </p>
        <div className='styleguide__primitive'>
          <div className='scope-title'>
            <button
              type='button'
              className='scope-title__nav scope-title__nav--prev'
              aria-label='Previous view'
              title='Previous view'
            >
              <Icon id='chevron-left' icon={ChevronLeftIcon} />
            </button>
            <div className='scope-title__label' role='button' tabIndex={0}>
              <header className='space-header'>
                <h1 className='space-header__title'>Discover</h1>
                <p className='space-header__tagline'>
                  People who chose to be findable.
                </p>
              </header>
            </div>
            <button
              type='button'
              className='scope-title__nav scope-title__nav--next'
              aria-label='Next view'
              title='Next view'
            >
              <Icon id='chevron-right' icon={ChevronRightIcon} />
            </button>
          </div>
        </div>

        <h3 className='styleguide__subsection-title'>Turnstile (FeedDrum)</h3>
        <p className='styleguide__note'>
          The cube-edge rotator between top-level views on a korner —{' '}
          <code>&lt;FeedDrum&gt;</code> quarter-turns one face out and the next
          in on rotator advance. Below is a static outline of one face; the real
          turn is a motion state, best refined by pushing the surface live and
          watching a swipe.
        </p>
        <div className='styleguide__primitive'>
          <div className='styleguide__drum-face'>
            <span className='styleguide__drum-face-label'>Face A</span>
            <span className='styleguide__drum-face-hint'>swipe →</span>
          </div>
        </div>

        <h3 className='styleguide__subsection-title'>
          Composer shell (compose-shell)
        </h3>
        <p className='styleguide__note'>
          The panel every korner&rsquo;s composer renders inside —{' '}
          <code>&lt;ComposeShell&gt;</code>. One look for compose across every
          korner (Booth, Albutts, Moments, Map trek, Nudges, Krew). Rendered
          here as a plain panel (no fixed backdrop) so it sits inline.
        </p>
        <div className='styleguide__primitive'>
          <div className='compose-shell__panel styleguide__compose-panel'>
            <header className='compose-shell__header'>
              <span className='compose-shell__icon'>
                <SpiralIcon />
              </span>
              <div className='compose-shell__titles'>
                <span className='compose-shell__label'>New event</span>
                <span className='compose-shell__subtitle'>Kalendar</span>
              </div>
              <button
                type='button'
                className='compose-shell__close'
                aria-label='Close composer'
                title='Close'
              >
                <Icon id='close' icon={CloseIcon} />
              </button>
            </header>
            <div className='compose-shell__body'>
              <p className='styleguide__note styleguide__note--in-panel'>
                Body slot — each korner drops its own compose form here.
                Feed-shaped composers might mount a status form; Booth mounts a
                set editor; Map trek mounts a GPX picker.
              </p>
            </div>
            <footer className='compose-shell__footer'>
              <button type='button' className='compose-shell__cancel'>
                Cancel
              </button>
              <button type='button' className='compose-shell__submit'>
                Post
              </button>
            </footer>
          </div>
        </div>

        <h3 className='styleguide__subsection-title'>KornerPill</h3>
        <div className='styleguide__row'>
          <KornerPill label='RSVP' />
          <KornerPill label='Attend now' variant='primary' />
          <KornerPill label='Cancel' variant='destructive' />
          <KornerPill label='Going' active />
        </div>

        <h3 className='styleguide__subsection-title'>Action squares</h3>
        <div className='event-detail styleguide__primitive'>
          <div className='event-detail__actions-row'>
            <button
              type='button'
              className='event-detail__action-square'
              aria-label='RSVP'
              title='RSVP'
            >
              <Icon
                id='check'
                icon={CheckIcon}
                className='event-detail__action-square__icon'
              />
            </button>
            <button
              type='button'
              className='event-detail__action-square'
              aria-label='Invite'
              title='Invite'
            >
              <Icon
                id='person_add'
                icon={PersonAddIcon}
                className='event-detail__action-square__icon'
              />
            </button>
            <button
              type='button'
              className='event-detail__action-square'
              aria-label='Share'
              title='Share'
            >
              <Icon
                id='share'
                icon={ShareIcon}
                className='event-detail__action-square__icon'
              />
            </button>
            <button
              type='button'
              className='event-detail__action-square event-detail__action-square--destructive'
              aria-label='Delete'
              title='Delete'
            >
              <Icon
                id='delete'
                icon={DeleteIcon}
                className='event-detail__action-square__icon'
              />
            </button>
          </div>
        </div>

        <h3 className='styleguide__subsection-title'>
          Event &ldquo;when&rdquo; block
        </h3>
        <div className='event-detail styleguide__primitive'>
          <div className='event-detail__when'>
            <span className='event-detail__when__weekday'>FRIDAY</span>
            <span className='event-detail__when__date'>23 October 2026</span>
            <span className='event-detail__when__time'>15:20 – 17:20</span>
          </div>
        </div>

        <h3 className='styleguide__subsection-title'>
          Amongst Krew (mini-hub tile grid)
        </h3>
        <div className='styleguide__primitive'>
          <section className='attachment-section'>
            <header className='attachment-section__header'>
              <h3 className='attachment-section__heading'>Amongst Krew</h3>
            </header>
            <div className='attachment-section__grid'>
              <div className='attachment-section__tile'>
                <span className='attachment-section__tile-link'>
                  <SpiralIcon className='attachment-section__tile-glyph' />
                  <span className='attachment-section__tile-name'>
                    Kalendar
                  </span>
                </span>
              </div>
              <div className='attachment-section__tile'>
                <span className='attachment-section__tile-link'>
                  <ShareIcon className='attachment-section__tile-glyph' />
                  <span className='attachment-section__tile-name'>
                    Booth Set
                  </span>
                </span>
              </div>
              <div className='attachment-section__tile'>
                <span className='attachment-section__tile-link'>
                  <PersonAddIcon className='attachment-section__tile-glyph' />
                  <span className='attachment-section__tile-name'>Krew</span>
                </span>
              </div>
            </div>
          </section>
        </div>

        <h3 className='styleguide__subsection-title'>
          ProfileCard (peek + deck)
        </h3>
        <div className='styleguide__primitive styleguide__primitive--profile-card'>
          <article className='profile-card' aria-label='Marise Kowalski'>
            <div className='profile-card__cover profile-card__cover--fallback'>
              <div className='profile-card__avatar' aria-hidden='true' />
            </div>
            <div className='profile-card__body'>
              <h2 className='profile-card__name'>Marise Kowalski</h2>
              <div className='profile-card__handle'>@marise</div>
              <p className='profile-card__bio'>
                Welder, gardener, mother of two. Building the shed I always
                wanted. Trying to say yes to the small things.
              </p>
              <div
                className='profile-card__matuals'
                role='group'
                aria-label='Matuals'
              >
                <div className='profile-card__matuals-label'>Matuals</div>
                <div className='profile-card__matuals-row'>
                  <span
                    className='profile-card__matuals-stack'
                    aria-hidden='true'
                  >
                    <span className='profile-card__matuals-avatar' />
                    <span className='profile-card__matuals-avatar' />
                    <span className='profile-card__matuals-avatar' />
                  </span>
                  <span className='profile-card__matuals-copy'>
                    <strong>Chris</strong>, <strong>Isabelle</strong> +{' '}
                    <strong>4 more</strong>
                  </span>
                </div>
              </div>
            </div>
            <div className='profile-card__actions'>
              <button
                type='button'
                className='profile-card__icon profile-card__icon--mate profile-card__icon--send'
                aria-label='Mate?'
                title='Mate?'
              >
                <Icon id='mate' icon={PersonAddIcon} />
              </button>
              <a
                className='profile-card__icon profile-card__icon--open'
                href='/styleguide#profile-card'
                aria-label='Open profile'
                title='Open profile'
              >
                <Icon id='open' icon={ChevronRightIcon} />
              </a>
            </div>
          </article>
          <article
            className='profile-card profile-card--matched'
            aria-label='Mango (already mates)'
          >
            <div className='profile-card__cover profile-card__cover--fallback'>
              <div className='profile-card__avatar' aria-hidden='true' />
            </div>
            <div className='profile-card__body'>
              <h2 className='profile-card__name'>Mango</h2>
              <div className='profile-card__handle'>@itsmango</div>
              <p className='profile-card__bio'>
                Product designer &amp; long-distance runner. Occasional writer.
              </p>
            </div>
            <div className='profile-card__actions'>
              <button
                type='button'
                className='profile-card__icon profile-card__icon--mate profile-card__icon--mate'
                aria-label='Unmate'
                title='Mates'
              >
                <Icon id='mate' icon={CheckIcon} />
              </button>
              <a
                className='profile-card__icon profile-card__icon--open'
                href='/styleguide#profile-card'
                aria-label='Open profile'
                title='Open profile'
              >
                <Icon id='open' icon={ChevronRightIcon} />
              </a>
            </div>
          </article>
          <article
            className='profile-card profile-card--pending'
            aria-label='Chris (pending)'
          >
            <div className='profile-card__cover profile-card__cover--fallback'>
              <div className='profile-card__avatar' aria-hidden='true' />
            </div>
            <div className='profile-card__body'>
              <h2 className='profile-card__name'>Chris Bianca</h2>
              <div className='profile-card__handle'>@chris</div>
              <p className='profile-card__bio'>
                Software, land, and long walks. Currently rethinking how new
                people meet the community.
              </p>
            </div>
            <div className='profile-card__actions'>
              <button
                type='button'
                className='profile-card__icon profile-card__icon--mate profile-card__icon--pending'
                aria-label='Withdraw request'
                title='Request pending'
              >
                <Icon id='mate' icon={HourglassIcon} />
              </button>
              <a
                className='profile-card__icon profile-card__icon--open'
                href='/styleguide#profile-card'
                aria-label='Open profile'
                title='Open profile'
              >
                <Icon id='open' icon={ChevronRightIcon} />
              </a>
            </div>
          </article>
        </div>

        <h3 className='styleguide__subsection-title'>KornerActionBar</h3>
        <p className='styleguide__note'>
          The horizontal action row that sits under a detail-page title. Layout
          on the bar, styling on the <code>&lt;KornerPill&gt;</code> children
          (Edit / Share / Delete etc.). Alignment modifier controls
          justify-content.
        </p>
        <div className='styleguide__primitive'>
          <div className='korner-action-bar korner-action-bar--align-start'>
            <KornerPill label='Edit' />
            <KornerPill label='Share' variant='primary' />
            <KornerPill label='Delete' variant='destructive' />
          </div>
        </div>

        <h3 className='styleguide__subsection-title'>
          Status card (feed post)
        </h3>
        <p className='styleguide__note'>
          Simplified outline of the shared feed post surface — header + content
          + action row (reply / boost / favourite / share). The real{' '}
          <code>&lt;Status&gt;</code> pulls from Redux; this is a static preview
          of the chrome for refinement.
        </p>
        <div className='styleguide__primitive'>
          <article className='styleguide__status'>
            <header className='styleguide__status-header'>
              <span className='styleguide__status-avatar' aria-hidden='true' />
              <div className='styleguide__status-names'>
                <span className='styleguide__status-name'>Marise</span>
                <span className='styleguide__status-handle'>@marise · 2h</span>
              </div>
            </header>
            <p className='styleguide__status-content'>
              Fermented the last of the plums this morning. Everything the
              orchard gave, put away for winter. Feels like a good week.
            </p>
            <div className='styleguide__status-actions'>
              <button type='button' className='styleguide__status-action'>
                <Icon id='reply' icon={ChatBubbleIcon} />
                <span>3</span>
              </button>
              <button type='button' className='styleguide__status-action'>
                <Icon id='reblog' icon={RepeatIcon} />
                <span>1</span>
              </button>
              <button type='button' className='styleguide__status-action'>
                <Icon id='favourite' icon={FavoriteIcon} />
                <span>7</span>
              </button>
              <button type='button' className='styleguide__status-action'>
                <Icon id='share' icon={ShareIcon} />
              </button>
            </div>
          </article>
        </div>

        <h3 className='styleguide__subsection-title'>
          Feed cards (korner-embedded)
        </h3>
        <p className='styleguide__note'>
          When a korner record is posted to Orbit, it surfaces as one of these{' '}
          <code>&lt;StatusKornerCard&gt;</code>-based cards. All share the same
          chrome (korner badge top-right, tap-to-open) and differentiate by
          icon, badge label, and body treatment. Mock data below — the real
          cards pull from the SPA store / API.
        </p>
        <div className='styleguide__primitive styleguide__feed-cards'>
          <StatusEventCard
            event={{
              id: 'sg-event',
              slug: 'snowgum-skip',
              title: 'Snowgum Skip',
              description:
                'Going for a stroll / skip in the high country. Full moon weekend. Friday–Sunday.',
              start_time: '2026-10-23T09:20:00Z',
              end_time: '2026-10-23T11:20:00Z',
              location_name: 'Walking Track, Falls Creek',
              location_url:
                'https://www.openstreetmap.org/?mlat=-36.87&mlon=147.28#map=14/-36.87/147.28',
              event_type: 'event',
              huddle_url: null,
              rsvp_enabled: true,
              max_attendees: null,
              going_count: 7,
              interested_count: 3,
              going_preview: [
                {
                  id: 'a',
                  acct: 'chris',
                  avatar: '/avatars/original/missing.png',
                },
                {
                  id: 'b',
                  acct: 'tal',
                  avatar: '/avatars/original/missing.png',
                },
                {
                  id: 'c',
                  acct: 'ash',
                  avatar: '/avatars/original/missing.png',
                },
              ],
              image_url: null,
              rsvp: null,
              is_owner: false,
            }}
          />

          <StatusKommonsCard
            proposal={{
              id: 'sg-proposal',
              title: 'Rotate the Kommons moderators quarterly',
              summary:
                'Move to a three-month rotating roster so no single mod carries the weight past a season.',
              status: 'open',
              proposal_type: 'medium',
              support_count: 12,
              challenge_count: 2,
              participation_count: 16,
              categories: ['governance'],
              created_at: '2026-08-01T10:00:00Z',
            }}
          />

          <StatusAlbuttsCard
            album={{
              id: 'sg-album',
              title: 'Falls weekend',
              visibility: 'mates',
              photo_count: 34,
              contributor_count: 5,
              cover_url: null,
              contributor_avatars: [
                {
                  id: 'a',
                  acct: 'chris',
                  avatar: '/avatars/original/missing.png',
                },
                {
                  id: 'b',
                  acct: 'tal',
                  avatar: '/avatars/original/missing.png',
                },
                {
                  id: 'c',
                  acct: 'ash',
                  avatar: '/avatars/original/missing.png',
                },
              ],
            }}
          />

          <StatusBoothCard
            set={{
              id: 'sg-set',
              title: 'Kitchen mix — spring 2026',
              artist_name: 'DJ Chris',
              genres: ['downtempo', 'ambient'],
              duration_seconds: 2670,
              cover_url: null,
              event_name: null,
            }}
          />

          <StatusKuestionsCard
            question={{
              id: 'sg-question',
              title: 'What are you fermenting this month?',
              prompt:
                'Trying to build a picture of what everyone has going in the crock.',
              answer_format: 'text',
              answers_count: 9,
              has_answered: false,
              recent_answerer_avatars: [
                {
                  id: 'a',
                  acct: 'chris',
                  avatar: '/avatars/original/missing.png',
                },
                {
                  id: 'b',
                  acct: 'tal',
                  avatar: '/avatars/original/missing.png',
                },
              ],
            }}
          />

          <StatusTrekCard
            trek={{
              id: 'sg-trek',
              activity_type: 'run',
              title: 'Morning loop — river track',
              distance_m: 8420,
              moving_sec: 2760,
              pace_seconds: 328,
              speed_kmh: null,
              elevation_gain: 62,
              has_route: true,
              route: [
                [147.28, -36.87],
                [147.29, -36.86],
                [147.3, -36.86],
              ],
            }}
          />

          <StatusWachuneedCard
            listing={{
              id: 'sg-listing',
              title: 'Passata jars — reusable',
              description:
                'Have ~30 spare 700ml jars from the tomato weekend. Free to a good kitchen.',
              category: 'goods',
              subcategory: 'kitchen',
              price_display: 'free',
              location: 'Fitzroy',
            }}
          />
        </div>

        <h3 className='styleguide__subsection-title'>ShareSheet panel</h3>
        <p className='styleguide__note'>
          The Kronk share primitive (<code>&lt;ShareSheet&gt;</code>). Three
          actions: Send in Nudges (search mates), Copy link, native OS Share
          when available. Rendered inline (no fixed backdrop) so it sits in the
          guide&rsquo;s flow.
        </p>
        <div className='styleguide__primitive'>
          <div className='share-sheet__panel styleguide__share-panel'>
            <div className='share-sheet__header'>
              <div className='share-sheet__title'>
                Share
                <span className='share-sheet__subject'>Snowgum Skip</span>
              </div>
              <div className='share-sheet__header-actions'>
                <button
                  type='button'
                  className='share-sheet__action'
                  title='Copy link'
                  aria-label='Copy link'
                >
                  <Icon id='content_copy' icon={ContentCopyIcon} />
                </button>
                <button
                  type='button'
                  className='share-sheet__action'
                  title='Share…'
                  aria-label='Share'
                >
                  <Icon id='share' icon={ShareIcon} />
                </button>
                <button
                  type='button'
                  className='share-sheet__close'
                  title='Close'
                  aria-label='Close'
                >
                  <Icon id='close' icon={CloseIcon} />
                </button>
              </div>
            </div>
            <div className='share-sheet__prompt'>Send in Nudges</div>
            <input
              type='text'
              className='share-sheet__search'
              placeholder='Search mates…'
              readOnly
            />
            <ul className='share-sheet__results'>
              <li>
                <button type='button' className='share-sheet__result'>
                  <span
                    className='share-sheet__result-avatar'
                    aria-hidden='true'
                  />
                  <span className='share-sheet__result-name'>Chris</span>
                  <span className='share-sheet__result-acct'>@chris</span>
                </button>
              </li>
              <li>
                <button type='button' className='share-sheet__result'>
                  <span
                    className='share-sheet__result-avatar'
                    aria-hidden='true'
                  />
                  <span className='share-sheet__result-name'>Mango</span>
                  <span className='share-sheet__result-acct'>@itsmango</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        <h3 className='styleguide__subsection-title'>ProfilePeek scrim</h3>
        <p className='styleguide__note'>
          The full-viewport modal that wraps a single{' '}
          <code>&lt;ProfileCard&gt;</code>. Rendered here as a scaled-down box
          (dim scrim + centred card + close ×) so it sits inline. The real peek
          fills the viewport when opened via{' '}
          <code>
            openModal(&#123; modalType: &lsquo;PROFILE_PEEK&rsquo; &#125;)
          </code>
          .
        </p>
        <div className='styleguide__primitive'>
          <div className='styleguide__peek-frame'>
            <button
              type='button'
              className='styleguide__peek-close'
              aria-label='Close'
              title='Close'
            >
              <Icon id='close' icon={CloseIcon} />
            </button>
            <article className='profile-card styleguide__peek-card'>
              <div className='profile-card__cover profile-card__cover--fallback'>
                <div className='profile-card__avatar' aria-hidden='true' />
              </div>
              <div className='profile-card__body'>
                <h2 className='profile-card__name'>Marise Kowalski</h2>
                <div className='profile-card__handle'>@marise</div>
                <p className='profile-card__bio'>
                  Welder, gardener, mother of two.
                </p>
              </div>
              <div className='profile-card__actions'>
                <button
                  type='button'
                  className='profile-card__icon profile-card__icon--mate profile-card__icon--send'
                  aria-label='Mate?'
                  title='Mate?'
                >
                  <Icon id='mate' icon={PersonAddIcon} />
                </button>
                <a
                  className='profile-card__icon profile-card__icon--open'
                  href='/styleguide#profile-card'
                  aria-label='Open profile'
                  title='Open profile'
                >
                  <Icon id='open' icon={ChevronRightIcon} />
                </a>
              </div>
            </article>
          </div>
        </div>

        <h3 className='styleguide__subsection-title'>Attachment picker</h3>
        <p className='styleguide__note'>
          The modal behind the &ldquo;Attach…&rdquo; button on any korner detail
          page (<code>&lt;AttachmentPicker&gt;</code>). Rendered here as the
          bare panel; the real picker sits inside a fixed backdrop.
        </p>
        <div className='styleguide__primitive'>
          <div className='attachment-picker__panel styleguide__attachment-panel'>
            <header className='attachment-picker__header'>
              <h2 className='attachment-picker__title'>Attach something</h2>
              <button
                type='button'
                className='attachment-picker__close'
                aria-label='Close'
                title='Close'
              >
                <Icon id='close' icon={CloseIcon} />
              </button>
            </header>
            <div className='attachment-picker__target-chip'>
              <span className='attachment-picker__target-chip__label'>
                Attach to
              </span>
              <span className='attachment-picker__target-chip__body'>
                <SpiralIcon className='attachment-picker__target-chip__icon' />
                <span className='attachment-picker__target-chip__name'>
                  Kalendar
                </span>
              </span>
            </div>
            <input
              type='search'
              className='attachment-picker__search'
              placeholder='Search Kalendar…'
              readOnly
            />
            <div className='attachment-picker__results'>
              <button type='button' className='attachment-picker__result'>
                <SpiralIcon className='attachment-picker__result-icon' />
                <span className='attachment-picker__result-title'>
                  Snowgum Skip
                </span>
              </button>
              <button type='button' className='attachment-picker__result'>
                <SpiralIcon className='attachment-picker__result-icon' />
                <span className='attachment-picker__result-title'>
                  Kitchen Fermentation Circle
                </span>
              </button>
            </div>
          </div>
        </div>

        <h3 className='styleguide__subsection-title'>Visibility picker</h3>
        <p className='styleguide__note'>
          <code>&lt;KornerVisibilityPicker&gt;</code> — the audience picker used
          on every korner composer. Options come from the korner manifest&apos;s{' '}
          <code>visibility_scopes</code>.
        </p>
        <div className='styleguide__primitive'>
          <VisibilityPickerDemo slug='kalendar' />
        </div>

        <h3 className='styleguide__subsection-title'>Composer fields</h3>
        <p className='styleguide__note'>
          The Kronk-styled form primitives — soft purple wash on the input,
          purple border on focus. Match this treatment when adding new composer
          surfaces.
        </p>
        <div className='styleguide__primitive'>
          <div className='styleguide__composer-fields'>
            <label className='styleguide__composer-field'>
              <span className='styleguide__composer-label'>Text input</span>
              <input
                type='text'
                className='styleguide__composer-input'
                placeholder='A short line of text'
              />
            </label>
            <label className='styleguide__composer-field'>
              <span className='styleguide__composer-label'>Textarea</span>
              <textarea
                className='styleguide__composer-textarea'
                rows={4}
                placeholder='A longer body of text.'
              />
            </label>
            <label className='styleguide__composer-field'>
              <span className='styleguide__composer-label'>Select</span>
              <select className='styleguide__composer-input' defaultValue=''>
                <option value='' disabled>
                  Pick one…
                </option>
                <option>Option A</option>
                <option>Option B</option>
              </select>
            </label>
            <label className='styleguide__composer-field'>
              <span className='styleguide__composer-label'>File</span>
              <input type='file' className='styleguide__composer-file' />
            </label>
          </div>
        </div>

        <h3 className='styleguide__subsection-title'>Ж menu (Kronk menu)</h3>
        <p className='styleguide__note'>
          The floating action button. Trigger + a fan of moons (Post, per-page
          actions, Search, Settings). Rendered here inline without the fixed
          positioning + spiral animation so you can eyeball the parts.
        </p>
        <div className='styleguide__primitive styleguide__kmenu'>
          <div className='styleguide__kmenu-row'>
            <button
              type='button'
              className='kronk-menu__trigger styleguide__kmenu-trigger'
              aria-label='Kronk menu'
            >
              <span aria-hidden='true'>Ж</span>
            </button>
            <div className='styleguide__kmenu-moons'>
              <span
                className='kronk-menu__moon styleguide__kmenu-moon'
                aria-hidden='true'
                title='Post'
              >
                <span className='kronk-menu__moon-glyph'>
                  <AddIcon />
                </span>
              </span>
              <span
                className='kronk-menu__moon styleguide__kmenu-moon'
                aria-hidden='true'
                title='Search'
              >
                <span className='kronk-menu__moon-glyph'>
                  <SearchIcon />
                </span>
              </span>
              <span
                className='kronk-menu__moon styleguide__kmenu-moon'
                aria-hidden='true'
                title='Settings'
              >
                <span className='kronk-menu__moon-glyph'>
                  <SettingsIcon />
                </span>
              </span>
            </div>
          </div>
        </div>

        <h3 className='styleguide__subsection-title'>Empty &amp; loading</h3>
        <p className='styleguide__note'>
          The rest-state pattern for a korner surface with no content yet (
          <code>&lt;EmptyState&gt;</code>) and its transient sibling (
          <code>&lt;LoadingState&gt;</code>). Adopt-not-copy per{' '}
          <code>docs/kronk_platform_primitives.md</code>.
        </p>
        <div className='styleguide__primitive styleguide__state-grid'>
          <EmptyState
            title='Nothing coming up yet.'
            body="Kalendar's empty. Post an event to seed the shelf."
            action={<Link to='/hub/kalendar/composer'>Post an event</Link>}
          />
          <LoadingState label='Loading Kalendar…' />
        </div>

        <h3 className='styleguide__subsection-title'>Toast (alert)</h3>
        <p className='styleguide__note'>
          The Snackbar-style transient toast fired by{' '}
          <code>dispatch(showAlert(&#123; message &#125;))</code>. Real toasts
          slide in from the side, auto-dismiss after ~5s. Rendered here inline
          in its active state so it&apos;s not chasing you off-screen
          mid-review.
        </p>
        <div className='styleguide__primitive styleguide__toast'>
          <Alert
            title='Copied'
            message='Link copied to clipboard'
            isActive
            animateFrom='side'
          />
        </div>

        <h3 className='styleguide__subsection-title'>Settings kit</h3>
        <p className='styleguide__note'>
          The section wrapper (<code>&lt;SettingsSection&gt;</code>) and
          radio-card chooser (<code>&lt;SettingsRadioCards&gt;</code>) every
          settings surface reaches for. Extracted from the bespoke Krew and
          korner-settings styles so a change to spacing, hint colour, or card
          treatment lands everywhere at once.
        </p>
        <div className='styleguide__primitive'>
          <SettingsKitDemo />
        </div>

        <h3 className='styleguide__subsection-title'>Korner icons</h3>
        <p className='styleguide__note'>
          The full set of korner glyphs sourced from each manifest via{' '}
          <code>useKornerIcon</code>. Eyeball weight, stroke, size consistency
          across the family in one row.
        </p>
        <div className='styleguide__primitive'>
          <div className='styleguide__korner-icons'>
            {KORNER_SLUGS.map((slug) => (
              <KornerIconTile key={slug} slug={slug} />
            ))}
          </div>
        </div>
      </section>

      <section className='styleguide__section styleguide__section--how'>
        <h2 className='styleguide__section-title'>Changing the aesthetic</h2>
        <ol className='styleguide__how'>
          <li>
            Edit <code>app/javascript/mastodon/tokens/tokens.yaml</code>.
          </li>
          <li>
            Regenerate <code>_tokens.scss</code> via{' '}
            <code>bin/generate-tokens</code>.
          </li>
          <li>Refresh this page to preview.</li>
          <li>Ship when happy.</li>
        </ol>
        <p className='styleguide__how-hint'>
          Never hardcode hex codes, durations, or radii in component SCSS —
          stylelint will reject them. Every value goes through this file.
        </p>
      </section>
    </div>
  </Column>
);
