import { defineMessages } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import type { FtdProjektKind } from 'mastodon/api_types/freethedream';

// What sort of projekt it is (docs/spaces/freethedream.md, Kinds; Tal,
// 2026-11-10). Picked when it's seeded; each suggests a few Komponents to
// start with, which are only names to tap, not a template.

export const PROJEKT_KINDS: FtdProjektKind[] = [
  'gathering',
  'creation',
  'build',
  'organisation',
  'governance',
  'mutual_aid',
  'learning',
  'campaign',
];

export const kindMessages = defineMessages({
  question: {
    id: 'freethedream.kind.question',
    defaultMessage: 'What kind of projekt is it?',
  },
  label: { id: 'freethedream.kind.label', defaultMessage: 'Kind' },
  none: { id: 'freethedream.kind.none', defaultMessage: 'Not set' },
  change: { id: 'freethedream.kind.change', defaultMessage: 'Change kind' },
  suggestions: {
    id: 'freethedream.kind.suggestions',
    defaultMessage: 'Ideas to start with',
  },
});

const names = defineMessages({
  gathering: { id: 'freethedream.kind.gathering', defaultMessage: 'Gathering' },
  creation: { id: 'freethedream.kind.creation', defaultMessage: 'Creation' },
  build: { id: 'freethedream.kind.build', defaultMessage: 'Build' },
  organisation: {
    id: 'freethedream.kind.organisation',
    defaultMessage: 'Organisation',
  },
  governance: {
    id: 'freethedream.kind.governance',
    defaultMessage: 'Governance',
  },
  mutual_aid: {
    id: 'freethedream.kind.mutual_aid',
    defaultMessage: 'Mutual aid',
  },
  learning: { id: 'freethedream.kind.learning', defaultMessage: 'Learning' },
  campaign: { id: 'freethedream.kind.campaign', defaultMessage: 'Campaign' },
});

const hints = defineMessages({
  gathering: {
    id: 'freethedream.kind.gathering_hint',
    defaultMessage: 'A doof, a festival, a workshop, a dinner',
  },
  creation: {
    id: 'freethedream.kind.creation_hint',
    defaultMessage: 'Music, art, film or writing, made together',
  },
  build: {
    id: 'freethedream.kind.build_hint',
    defaultMessage: 'A garden, a stage, a van fit-out, some code',
  },
  organisation: {
    id: 'freethedream.kind.organisation_hint',
    defaultMessage: 'Running a group or a place over time',
  },
  governance: {
    id: 'freethedream.kind.governance_hint',
    defaultMessage: 'Deciding together: a policy, a constitution',
  },
  mutual_aid: {
    id: 'freethedream.kind.mutual_aid_hint',
    defaultMessage: 'A meal train, moving house, a working bee',
  },
  learning: {
    id: 'freethedream.kind.learning_hint',
    defaultMessage: 'A skill share, a study circle, teaching each other',
  },
  campaign: {
    id: 'freethedream.kind.campaign_hint',
    defaultMessage: 'Getting the word out, standing up for something',
  },
});

const ideas = defineMessages({
  site: { id: 'freethedream.kind.idea.site', defaultMessage: 'Site' },
  kitchen: { id: 'freethedream.kind.idea.kitchen', defaultMessage: 'Kitchen' },
  sound: { id: 'freethedream.kind.idea.sound', defaultMessage: 'Sound' },
  onTheDay: {
    id: 'freethedream.kind.idea.on_the_day',
    defaultMessage: 'On the day',
  },
  ideas: { id: 'freethedream.kind.idea.ideas', defaultMessage: 'Ideas' },
  inProgress: {
    id: 'freethedream.kind.idea.in_progress',
    defaultMessage: 'Works in progress',
  },
  release: { id: 'freethedream.kind.idea.release', defaultMessage: 'Release' },
  materials: {
    id: 'freethedream.kind.idea.materials',
    defaultMessage: 'Materials',
  },
  stages: { id: 'freethedream.kind.idea.stages', defaultMessage: 'Stages' },
  tools: { id: 'freethedream.kind.idea.tools', defaultMessage: 'Tools' },
  roles: { id: 'freethedream.kind.idea.roles', defaultMessage: 'Roles' },
  money: { id: 'freethedream.kind.idea.money', defaultMessage: 'Money' },
  comms: { id: 'freethedream.kind.idea.comms', defaultMessage: 'Comms' },
  questions: {
    id: 'freethedream.kind.idea.questions',
    defaultMessage: 'Questions',
  },
  drafts: { id: 'freethedream.kind.idea.drafts', defaultMessage: 'Drafts' },
  decisions: {
    id: 'freethedream.kind.idea.decisions',
    defaultMessage: 'Decisions',
  },
  roster: { id: 'freethedream.kind.idea.roster', defaultMessage: 'Roster' },
  needs: { id: 'freethedream.kind.idea.needs', defaultMessage: 'Needs' },
  topics: { id: 'freethedream.kind.idea.topics', defaultMessage: 'Topics' },
  sessions: {
    id: 'freethedream.kind.idea.sessions',
    defaultMessage: 'Sessions',
  },
  resources: {
    id: 'freethedream.kind.idea.resources',
    defaultMessage: 'Resources',
  },
  message: { id: 'freethedream.kind.idea.message', defaultMessage: 'Message' },
  outreach: {
    id: 'freethedream.kind.idea.outreach',
    defaultMessage: 'Outreach',
  },
  actions: { id: 'freethedream.kind.idea.actions', defaultMessage: 'Actions' },
});

const SUGGESTIONS: Record<FtdProjektKind, MessageDescriptor[]> = {
  gathering: [ideas.site, ideas.kitchen, ideas.sound, ideas.onTheDay],
  creation: [ideas.ideas, ideas.inProgress, ideas.release],
  build: [ideas.materials, ideas.stages, ideas.tools],
  organisation: [ideas.roles, ideas.money, ideas.comms],
  governance: [ideas.questions, ideas.drafts, ideas.decisions],
  mutual_aid: [ideas.roster, ideas.needs],
  learning: [ideas.topics, ideas.sessions, ideas.resources],
  campaign: [ideas.message, ideas.outreach, ideas.actions],
};

export const kindName = (kind: FtdProjektKind) => names[kind];
export const kindHint = (kind: FtdProjektKind) => hints[kind];
export const kindSuggestions = (kind: FtdProjektKind | null | undefined) =>
  kind ? SUGGESTIONS[kind] : [];
