import { defineMessages, useIntl } from 'react-intl';

import {
  SettingsPage,
  SettingsSection,
  SettingsActionRow,
} from 'mastodon/features/settings/components';

// Data — export / import surface. Kronk-native chrome over the Rails
// archive backup job, CSV downloads, and multipart import+confirm flow;
// same "link out to Rails" pattern the Account page uses for security
// flows. Full-page navigation is intentional — no JSON API for these.

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
  importHeading: {
    id: 'data_settings.import_heading',
    defaultMessage: 'Import',
  },
  import: {
    id: 'data_settings.import',
    defaultMessage: 'Import follows, blocks and lists',
  },
  importHint: {
    id: 'data_settings.import_hint',
    defaultMessage: 'Upload a CSV — from Kronk, Mastodon, or another server.',
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

      <SettingsSection title={intl.formatMessage(messages.importHeading)}>
        <SettingsActionRow
          href='/settings/imports'
          label={intl.formatMessage(messages.import)}
          description={intl.formatMessage(messages.importHint)}
        />
      </SettingsSection>
    </SettingsPage>
  );
};
