import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import { Helmet } from 'react-helmet';

import { fetchSuggestions } from 'mastodon/actions/suggestions';
import { apiRequestGet, apiRequestPut } from 'mastodon/api';
import { Avatar } from 'mastodon/components/avatar';
import { DisplayName } from 'mastodon/components/display_name';
import { FollowButton } from 'mastodon/components/follow_button';
import { ProfileBioField } from 'mastodon/components/profile_bio_field';
import { PushPrompt } from 'mastodon/components/push_prompt';
import { Stage } from 'mastodon/components/stage';
import { HueWidget } from 'mastodon/features/settings/setting_widgets';
import { SettingsSpaceHeader } from 'mastodon/features/settings/space_header';
import { useSaveQueue } from 'mastodon/hooks/useSaveQueue';
import { useAppDispatch, useAppSelector } from 'mastodon/store';
import { applyPersonalAppearance } from 'mastodon/utils/personal_appearance';

// Setup — the short steps a new member lands on after signup
// (docs/design.md, Signup and the thresholds; decisions.md, 2026-10-22
// "Setup after signup"): how Kronk looks, a line about you, who sees your
// posts by default, a few people to mate, and notifications on this device. Every step can be skipped and every choice
// changed later in Settings. Finishing goes to Home with a full load, so
// the theme picked here is the one the app opens in and the first-run
// walkthrough starts from there.
//
// It writes through the same endpoints and pieces as Settings → Appearance,
// Settings → Posting, the profile's bio and Settings → Notifications;
// nothing here is stored anywhere else.

const STEPS = ['look', 'about', 'reach', 'people', 'notify'] as const;
type Step = (typeof STEPS)[number];

const messages = defineMessages({
  title: { id: 'setup.title', defaultMessage: 'Make Kronk yours' },
  stepOf: { id: 'setup.step_of', defaultMessage: 'Step {n} of {total}' },
  next: { id: 'setup.next', defaultMessage: 'Next' },
  back: { id: 'setup.back', defaultMessage: 'Back' },
  skip: { id: 'setup.skip', defaultMessage: 'Skip setup' },
  finish: { id: 'setup.finish', defaultMessage: 'Go Home' },
  later: {
    id: 'setup.later',
    defaultMessage: 'You can change any of this later in Settings.',
  },
  lookTitle: { id: 'setup.look.title', defaultMessage: 'How Kronk looks' },
  lookIntro: {
    id: 'setup.look.intro',
    defaultMessage: 'Pick a theme, then slide to your shade of Kronk-purple.',
  },
  themeDark: { id: 'setup.look.dark', defaultMessage: 'Dark' },
  themeDarkHint: {
    id: 'setup.look.dark_hint',
    defaultMessage: 'Night sky, light text',
  },
  themeLight: { id: 'setup.look.light', defaultMessage: 'Light' },
  themeLightHint: {
    id: 'setup.look.light_hint',
    defaultMessage: 'Pale pages, dark text',
  },
  themeSystem: { id: 'setup.look.system', defaultMessage: 'Match my device' },
  themeSystemHint: {
    id: 'setup.look.system_hint',
    defaultMessage: 'Follows your phone or computer',
  },
  shade: { id: 'setup.look.shade', defaultMessage: 'Your shade' },
  reachTitle: {
    id: 'setup.reach.title',
    defaultMessage: 'Who sees your posts',
  },
  reachIntro: {
    id: 'setup.reach.intro',
    defaultMessage:
      'Where a new post goes unless you choose otherwise. You can still pick per post.',
  },
  reachKronk: { id: 'reach.kronk', defaultMessage: 'Kronkverse' },
  reachKronkHint: {
    id: 'reach.kronk_hint',
    defaultMessage: 'Everyone on Kronk',
  },
  reachOrbit: { id: 'reach.orbit', defaultMessage: 'Orbit' },
  reachOrbitHint: {
    id: 'reach.orbit_hint',
    defaultMessage: 'Your mates, and theirs',
  },
  reachMates: { id: 'reach.mates', defaultMessage: 'Mates' },
  reachMatesHint: {
    id: 'reach.mates_hint',
    defaultMessage: 'People who mate you back',
  },
  reachMe: { id: 'reach.me', defaultMessage: 'Me' },
  reachMeHint: { id: 'reach.me_hint', defaultMessage: 'Only you' },
  aboutTitle: { id: 'setup.about.title', defaultMessage: 'About you' },
  aboutIntro: {
    id: 'setup.about.intro',
    defaultMessage:
      'A line or two for your profile, so people know who you are.',
  },
  notifyTitle: {
    id: 'setup.notify.title',
    defaultMessage: 'Notifications',
  },
  notifyIntro: {
    id: 'setup.notify.intro',
    defaultMessage:
      'Hear about mates, messages and nudges on this device. You choose which ones in Settings.',
  },
  peopleTitle: { id: 'setup.people.title', defaultMessage: 'A few people' },
  peopleIntro: {
    id: 'setup.people.intro',
    defaultMessage: 'Mate a few people to start your feed.',
  },
  peopleEmpty: {
    id: 'setup.people.empty',
    defaultMessage:
      'No one to suggest yet. The Kommunity orb shows who is around.',
  },
});

interface Choice {
  value: string;
  label: MessageDescriptor;
  hint: MessageDescriptor;
}

// `default` is the dark skin; `contrast` stays in Settings only.
const THEMES: Choice[] = [
  { value: 'default', label: messages.themeDark, hint: messages.themeDarkHint },
  {
    value: 'mastodon-light',
    label: messages.themeLight,
    hint: messages.themeLightHint,
  },
  {
    value: 'system',
    label: messages.themeSystem,
    hint: messages.themeSystemHint,
  },
];

// The reach ladder, widest first (docs/spaces/feed.md).
const REACHES: Choice[] = [
  {
    value: 'public',
    label: messages.reachKronk,
    hint: messages.reachKronkHint,
  },
  { value: 'orbit', label: messages.reachOrbit, hint: messages.reachOrbitHint },
  { value: 'mates', label: messages.reachMates, hint: messages.reachMatesHint },
  { value: 'self_only', label: messages.reachMe, hint: messages.reachMeHint },
];

interface Payload {
  values: Record<string, unknown>;
}

const stepFromHash = (): Step => {
  const hash = window.location.hash.replace('#', '');
  return (STEPS as readonly string[]).includes(hash) ? (hash as Step) : 'look';
};

// A full load, so Home opens in the chosen theme and the tour starts.
const goHome = () => {
  window.location.assign('/home');
};

const ChoiceButton: React.FC<{
  choice: Choice;
  selected: boolean;
  onPick: (value: string) => void;
}> = ({ choice, selected, onPick }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onPick(choice.value);
  }, [choice.value, onPick]);

  return (
    <button
      type='button'
      className='setup__choice'
      aria-pressed={selected}
      onClick={handleClick}
    >
      <span className='setup__choice-label'>
        {intl.formatMessage(choice.label)}
      </span>
      <span className='setup__choice-hint'>
        {intl.formatMessage(choice.hint)}
      </span>
    </button>
  );
};

// Load one settings endpoint and save single fields back to it.
const useSettings = (path: `v1/settings/${string}`) => {
  const [values, setValues] = useState<Record<string, unknown> | null>(null);
  const queueSave = useSaveQueue();

  useEffect(() => {
    let cancelled = false;
    void apiRequestGet<Payload>(path)
      .then((res) => {
        if (!cancelled) setValues(res.values);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setValues({});
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  const save = useCallback(
    (name: string, value: unknown) => {
      setValues((v) => ({ ...v, [name]: value }));
      return queueSave(() => apiRequestPut<Payload>(path, { [name]: value }))
        .done;
    },
    [path, queueSave],
  );

  return { values, save };
};

const LookStep: React.FC = () => {
  const intl = useIntl();
  const { values, save } = useSettings('v1/settings/appearance');

  const handleTheme = useCallback(
    (theme: string) => {
      if (values?.theme === theme) return;
      // The theme is a different stylesheet: reload into this step to see it.
      void save('theme', theme).then(() => {
        window.location.hash = 'look';
        window.location.reload();
        return undefined;
      });
    },
    [values, save],
  );

  const handleHue = useCallback(
    (hue: number | null) => {
      applyPersonalAppearance({
        accent: (values?.personal_accent as string) || null,
        purpleHue: hue,
        fontDisplay: (values?.personal_font_display as string) || null,
        fontBody: (values?.personal_font_body as string) || null,
        uiScale: (values?.ui_scale as string) || null,
      });
      void save('personal_purple_hue', hue).catch(() => undefined);
    },
    [values, save],
  );

  if (!values) return null;

  return (
    <>
      <div className='setup__choices' role='group'>
        {THEMES.map((choice) => (
          <ChoiceButton
            key={choice.value}
            choice={choice}
            selected={(values.theme ?? 'default') === choice.value}
            onPick={handleTheme}
          />
        ))}
      </div>
      <div className='setup__shade'>
        <span className='setup__shade-label'>
          {intl.formatMessage(messages.shade)}
        </span>
        <HueWidget
          value={values.personal_purple_hue as number | string | null}
          onChange={handleHue}
        />
      </div>
    </>
  );
};

const ReachStep: React.FC = () => {
  const { values, save } = useSettings('v1/settings/posting');

  const handlePick = useCallback(
    (privacy: string) => {
      void save('default_privacy', privacy).catch(() => undefined);
    },
    [save],
  );

  if (!values) return null;

  return (
    <div className='setup__choices' role='group'>
      {REACHES.map((choice) => (
        <ChoiceButton
          key={choice.value}
          choice={choice}
          selected={values.default_privacy === choice.value}
          onPick={handlePick}
        />
      ))}
    </div>
  );
};

const Person: React.FC<{ id: string }> = ({ id }) => {
  const account = useAppSelector((state) => state.accounts.get(id));
  if (!account) return null;

  return (
    <li className='setup__person'>
      <Avatar account={account} size={44} />
      <DisplayName account={account} />
      <FollowButton accountId={id} compact />
    </li>
  );
};

const PeopleStep: React.FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const suggestions = useAppSelector((state) => state.suggestions.items);
  const isLoading = useAppSelector((state) => state.suggestions.isLoading);

  useEffect(() => {
    void dispatch(fetchSuggestions());
  }, [dispatch]);

  if (isLoading && suggestions.length === 0) return null;
  if (suggestions.length === 0) {
    return (
      <p className='setup__empty'>{intl.formatMessage(messages.peopleEmpty)}</p>
    );
  }

  return (
    <ul className='setup__people'>
      {suggestions.slice(0, 8).map((s) => (
        <Person key={s.account_id} id={s.account_id} />
      ))}
    </ul>
  );
};

const STEP_COPY: Record<Step, [MessageDescriptor, MessageDescriptor]> = {
  look: [messages.lookTitle, messages.lookIntro],
  about: [messages.aboutTitle, messages.aboutIntro],
  reach: [messages.reachTitle, messages.reachIntro],
  people: [messages.peopleTitle, messages.peopleIntro],
  notify: [messages.notifyTitle, messages.notifyIntro],
};

export const Setup: React.FC = () => {
  const intl = useIntl();
  const [step, setStep] = useState<Step>(stepFromHash);
  const index = STEPS.indexOf(step);
  const last = index === STEPS.length - 1;

  const goTo = useCallback((next: Step) => {
    window.history.replaceState(null, '', `#${next}`);
    setStep(next);
  }, []);

  const handleNext = useCallback(() => {
    const next = STEPS[index + 1];
    if (!next) goHome();
    else goTo(next);
  }, [index, goTo]);

  const handleBack = useCallback(() => {
    const prev = STEPS[index - 1];
    if (prev) goTo(prev);
  }, [index, goTo]);

  const [title, intro] = STEP_COPY[step];
  const heading = intl.formatMessage(messages.title);

  return (
    <Stage label={heading}>
      <Helmet>
        <title>{heading}</title>
      </Helmet>

      <div className='scrollable setup'>
        <SettingsSpaceHeader
          title={intl.formatMessage(title)}
          tagline={intl.formatMessage(intro)}
        />
        <p className='setup__progress'>
          {intl.formatMessage(messages.stepOf, {
            n: index + 1,
            total: STEPS.length,
          })}
        </p>
        <div className='setup__body'>
          {step === 'look' && <LookStep />}
          {step === 'about' && <ProfileBioField />}
          {step === 'reach' && <ReachStep />}
          {step === 'people' && <PeopleStep />}
          {step === 'notify' && <PushPrompt variant='settings' />}
        </div>

        <div className='setup__actions'>
          {index > 0 && (
            <button type='button' className='setup__back' onClick={handleBack}>
              {intl.formatMessage(messages.back)}
            </button>
          )}
          {!last && (
            <button type='button' className='setup__skip' onClick={goHome}>
              {intl.formatMessage(messages.skip)}
            </button>
          )}
          <button type='button' className='setup__next' onClick={handleNext}>
            {intl.formatMessage(last ? messages.finish : messages.next)}
          </button>
        </div>

        <p className='setup__later'>{intl.formatMessage(messages.later)}</p>
      </div>
    </Stage>
  );
};
