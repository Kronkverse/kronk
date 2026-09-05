import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { AllSettingsFooter } from 'mastodon/components/all_settings_footer';
import { Stage } from 'mastodon/components/stage';
import { SettingsSpaceHeader } from 'mastodon/features/settings/space_header';

// Data — the export / import surface (settings.data). Kronk-native chrome
// (Stage + L12 .space-header) over the classic Rails machinery: the archive
// backup job, the CSV downloads, and the multipart import+confirm flow all
// work in Rails and have no JSON API, so — like the security flows on the
// Account page — the surface is native and the operations link out rather
// than being rebuilt blind. Full-page navigation to Rails is intentional.

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
  csvFollows: { id: 'data_settings.csv_follows', defaultMessage: 'Follows' },
  csvBlocks: { id: 'data_settings.csv_blocks', defaultMessage: 'Blocks' },
  csvMutes: { id: 'data_settings.csv_mutes', defaultMessage: 'Mutes' },
  csvLists: { id: 'data_settings.csv_lists', defaultMessage: 'Lists' },
  csvDomainBlocks: {
    id: 'data_settings.csv_domain_blocks',
    defaultMessage: 'Blocked domains',
  },
  csvBookmarks: {
    id: 'data_settings.csv_bookmarks',
    defaultMessage: 'Bookmarks',
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

// CSV downloads are direct file responses from Rails, so they're plain
// download links (same session cookie), not SPA content.
const CSV_EXPORTS = [
  { key: 'csvFollows' as const, href: '/settings/exports/follows.csv' },
  { key: 'csvBlocks' as const, href: '/settings/exports/blocks.csv' },
  { key: 'csvMutes' as const, href: '/settings/exports/mutes.csv' },
  { key: 'csvLists' as const, href: '/settings/exports/lists.csv' },
  {
    key: 'csvDomainBlocks' as const,
    href: '/settings/exports/domain_blocks.csv',
  },
  { key: 'csvBookmarks' as const, href: '/settings/exports/bookmarks.csv' },
];

export const DataSettings: React.FC = () => {
  const intl = useIntl();

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='scrollable data-settings'>
        <SettingsSpaceHeader
          title={intl.formatMessage(messages.title)}
          tagline={intl.formatMessage(messages.intro)}
        />

        <section className='data-settings__section'>
          <h2 className='data-settings__heading'>
            {intl.formatMessage(messages.exportHeading)}
          </h2>
          <a className='data-settings__link' href='/settings/export'>
            <span className='data-settings__link-main'>
              <span className='data-settings__link-title'>
                {intl.formatMessage(messages.archive)}
              </span>
              <span className='data-settings__link-hint'>
                {intl.formatMessage(messages.archiveHint)}
              </span>
            </span>
            <span className='data-settings__chevron' aria-hidden='true'>
              ›
            </span>
          </a>
        </section>

        <section className='data-settings__section'>
          <h2 className='data-settings__heading'>
            {intl.formatMessage(messages.csvHeading)}
          </h2>
          <ul className='data-settings__csv'>
            {CSV_EXPORTS.map((csv) => (
              <li key={csv.key}>
                <a className='data-settings__csv-link' href={csv.href} download>
                  {intl.formatMessage(messages[csv.key])}
                  <span className='data-settings__csv-ext' aria-hidden='true'>
                    .csv
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className='data-settings__section'>
          <h2 className='data-settings__heading'>
            {intl.formatMessage(messages.importHeading)}
          </h2>
          <a className='data-settings__link' href='/settings/imports'>
            <span className='data-settings__link-main'>
              <span className='data-settings__link-title'>
                {intl.formatMessage(messages.import)}
              </span>
              <span className='data-settings__link-hint'>
                {intl.formatMessage(messages.importHint)}
              </span>
            </span>
            <span className='data-settings__chevron' aria-hidden='true'>
              ›
            </span>
          </a>
        </section>

        <AllSettingsFooter />
      </div>
    </Stage>
  );
};
