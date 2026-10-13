import { defineMessages } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import type { Flow, Symptom } from 'mastodon/api/klot';

// The words for how heavy a bleed was and how a day felt. The keys are
// the server's (CycleDay::FLOWS, CycleDay::SYMPTOMS).

const flows = defineMessages({
  spotting: { id: 'klot.flow.spotting', defaultMessage: 'Spotting' },
  light: { id: 'klot.flow.light', defaultMessage: 'Light' },
  medium: { id: 'klot.flow.medium', defaultMessage: 'Medium' },
  heavy: { id: 'klot.flow.heavy', defaultMessage: 'Heavy' },
});

export const FLOWS: Flow[] = ['spotting', 'light', 'medium', 'heavy'];
export const FLOW_LABEL: Record<Flow, MessageDescriptor> = flows;

const symptoms = defineMessages({
  cramps: { id: 'klot.symptom.cramps', defaultMessage: 'Cramps' },
  headache: { id: 'klot.symptom.headache', defaultMessage: 'Headache' },
  backache: { id: 'klot.symptom.backache', defaultMessage: 'Backache' },
  tender_breasts: {
    id: 'klot.symptom.tender_breasts',
    defaultMessage: 'Tender breasts',
  },
  bloating: { id: 'klot.symptom.bloating', defaultMessage: 'Bloating' },
  nausea: { id: 'klot.symptom.nausea', defaultMessage: 'Nausea' },
  tired: { id: 'klot.symptom.tired', defaultMessage: 'Tired' },
  energetic: { id: 'klot.symptom.energetic', defaultMessage: 'Energetic' },
  low: { id: 'klot.symptom.low', defaultMessage: 'Low' },
  anxious: { id: 'klot.symptom.anxious', defaultMessage: 'Anxious' },
  irritable: { id: 'klot.symptom.irritable', defaultMessage: 'Irritable' },
  calm: { id: 'klot.symptom.calm', defaultMessage: 'Calm' },
  cravings: { id: 'klot.symptom.cravings', defaultMessage: 'Cravings' },
  acne: { id: 'klot.symptom.acne', defaultMessage: 'Skin breakout' },
  poor_sleep: { id: 'klot.symptom.poor_sleep', defaultMessage: 'Poor sleep' },
  high_desire: {
    id: 'klot.symptom.high_desire',
    defaultMessage: 'High desire',
  },
});

export const SYMPTOM_LABEL: Record<Symptom, MessageDescriptor> = symptoms;

const groups = defineMessages({
  body: { id: 'klot.symptoms.body', defaultMessage: 'Body' },
  mood: { id: 'klot.symptoms.mood', defaultMessage: 'Mood and energy' },
  other: { id: 'klot.symptoms.other', defaultMessage: 'Also' },
});

export const SYMPTOM_GROUPS: { title: MessageDescriptor; items: Symptom[] }[] =
  [
    {
      title: groups.body,
      items: [
        'cramps',
        'headache',
        'backache',
        'tender_breasts',
        'bloating',
        'nausea',
      ],
    },
    {
      title: groups.mood,
      items: ['tired', 'energetic', 'low', 'anxious', 'irritable', 'calm'],
    },
    {
      title: groups.other,
      items: ['cravings', 'acne', 'poor_sleep', 'high_desire'],
    },
  ];
