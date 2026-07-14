import { Helmet } from 'react-helmet';

import { Column } from 'mastodon/components/column';
import { ColumnBackButton } from 'mastodon/components/column_back_button';

// Living style guide — the source of truth for what every Kronk token
// looks like when applied. Change tokens.yaml, refresh, see the
// result. Includes: palette, semantic surfaces, typography, radius
// scale, elevation, motion, and representative buttons/cards/chips
// using each.

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
  { name: 'menu', var: '--elevation-menu', use: 'Ӂ menu panel, modals' },
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

export default StyleGuide;
