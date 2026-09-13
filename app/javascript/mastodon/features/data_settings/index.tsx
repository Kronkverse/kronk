import { defineMessages, useIntl } from 'react-intl';

import {
  SettingsPage,
  SettingsSection,
  SettingsActionRow,
} from 'mastodon/features/settings/components';

import { ImportSection } from './import_section';

// Data — export / import surface. Archive requests + CSV imports are
// native SPA surfaces; CSVs stay as direct-download anchor tags since
// they're just file responses. The archive section (past PR) lives
// via the wheel-driven data page; this page adds the import surface.

const messages = defineMessages({
  title: { id: 'data_settings.title', defaultMessage: 'Your data' },
  intro: {
    id: 'data_settings.intro',
    defaultMessage: 'Export a copy of your account, or import lists into it.',
  },
  exportHeading: {
    id: 'data_settings.export_heading',
    defaultMessage: 'Export',
  },
  archive: {
    id: 'data_settings.archive',
    defaultMessage: 'Download your archive',
  },
  archiveHint: {
    id: 'data_settings.archive_hint',
    defaultMessage: 'Your posts and uploaded media, as a downloadable file.',
  },
  csvHeading: {
    id: 'data_settings.csv_heading',
    defaultMessage: 'Export lists (CSV)',
  },
  csvHeadingDesc: {
    id: 'data_settings.csv_heading_desc',
    defaultMessage: 'One row per entry. Downloads immediately.',
  },
  csvFollows: { id: 'data_settings.csv_follows', defaultMessage: 'Follows' },
  csvFollowsHint: {
    id: 'data_settings.csv_follows_hint',
    defaultMessage: 'Everyone you follow, one per row.',
  },
  csvBlocks: { id: 'data_settings.csv_blocks', defaultMessage: 'Blocks' },
  csvBlocksHint: {
    id: 'data_settings.csv_blocks_hint',
    defaultMessage: 'Accounts you’ve blocked.',
  },
  csvMutes: { id: 'data_settings.csv_mutes', defaultMessage: 'Mutes' },
  csvMutesHint: {
    id: 'data_settings.csv_mutes_hint',
    defaultMessage: 'Accounts you’ve muted (kept out of your feed).',
  },
  csvLists: { id: 'data_settings.csv_lists', defaultMessage: 'Lists' },
  csvListsHint: {
    id: 'data_settings.csv_lists_hint',
    defaultMessage: 'Your lists and their members.',
  },
  csvDomainBlocks: {
    id: 'data_settings.csv_domain_blocks',
    defaultMessage: 'Blocked domains',
  },
  csvDomainBlocksHint: {
    id: 'data_settings.csv_domain_blocks_hint',
    defaultMessage: 'Whole servers you’ve blocked.',
  },
  csvBookmarks: {
    id: 'data_settings.csv_bookmarks',
    defaultMessage: 'Bookmarks',
  },
  csvBookmarksHint: {
    id: 'data_settings.csv_bookmarks_hint',
    defaultMessage: 'Posts you’ve saved.',
  },
});

const CSV_EXPORTS = [
  {
    labelMsg: messages.csvFollows,
    hintMsg: messages.csvFollowsHint,
    href: '/settings/exports/follows.csv',
  },
  {
    labelMsg: messages.csvBlocks,
    hintMsg: messages.csvBlocksHint,
    href: '/settings/exports/blocks.csv',
  },
  {
    labelMsg: messages.csvMutes,
    hintMsg: messages.csvMutesHint,
    href: '/settings/exports/mutes.csv',
  },
  {
    labelMsg: messages.csvLists,
    hintMsg: messages.csvListsHint,
    href: '/settings/exports/lists.csv',
  },
  {
    labelMsg: messages.csvDomainBlocks,
    hintMsg: messages.csvDomainBlocksHint,
    href: '/settings/exports/domain_blocks.csv',
  },
  {
    labelMsg: messages.csvBookmarks,
    hintMsg: messages.csvBookmarksHint,
    href: '/settings/exports/bookmarks.csv',
  },
];

export const DataSettings: React.FC = () => {
  const intl = useIntl();

  return (
    <SettingsPage
      title={intl.formatMessage(messages.title)}
      tagline={intl.formatMessage(messages.intro)}
    >
      <SettingsSection title={intl.formatMessage(messages.exportHeading)}>
        <SettingsActionRow
          href='/settings/export'
          label={intl.formatMessage(messages.archive)}
          description={intl.formatMessage(messages.archiveHint)}
        />
      </SettingsSection>

      <SettingsSection
        title={intl.formatMessage(messages.csvHeading)}
        description={intl.formatMessage(messages.csvHeadingDesc)}
      >
        {CSV_EXPORTS.map((csv) => (
          <SettingsActionRow
            key={csv.href}
            href={csv.href}
            label={intl.formatMessage(csv.labelMsg)}
            description={intl.formatMessage(csv.hintMsg)}
          />
        ))}
      </SettingsSection>

      <ImportSection />
    </SettingsPage>
  );
};
