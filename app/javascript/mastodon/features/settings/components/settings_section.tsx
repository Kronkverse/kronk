import type { ReactNode } from 'react';

// One grouped block of settings inside a page. Title + optional
// description, then children (typically `<SettingsRow>` /
// `<SettingsActionRow>` instances). Every settings page uses this
// so section chrome doesn't drift.

interface Props {
  title: string;
  description?: string;
  children: ReactNode;
  // Rare — pages that only have one section can omit the h2. Screen
  // readers still see the section via the wrapping <section> role.
  hideTitle?: boolean;
}

export const SettingsSection: React.FC<Props> = ({
  title,
  description,
  children,
  hideTitle = false,
}) => (
  <section className='settings-page__section' aria-label={title}>
    {!hideTitle && <h2 className='settings-page__section-title'>{title}</h2>}
    {description && (
      <p className='settings-page__section-desc'>{description}</p>
    )}
    <div className='settings-page__section-body'>{children}</div>
  </section>
);
