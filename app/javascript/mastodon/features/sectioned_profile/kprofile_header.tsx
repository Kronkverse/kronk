import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import type {
  ApiAccountJSON,
  ApiAccountFieldJSON,
} from 'mastodon/api_types/accounts';
import { me } from 'mastodon/initial_state';

// Independent header for the SectionedProfile route (/@user). Does NOT
// reuse any `.account__header__*` class names from upstream Mastodon —
// that would drag every layout property into a specificity fight with
// container queries + media rules the classic profile ships. The new
// `.kprofile__*` namespace stands on its own.
//
// Scope is deliberately narrow: identity strip only. Bell / share /
// familiar-followers / follow-button live back in AccountHeader for
// non-sectioned views. Edit-profile is the single owner action here.

const messages = defineMessages({
  edit: { id: 'kprofile.edit', defaultMessage: 'Edit profile' },
  posts: { id: 'kprofile.stats.posts', defaultMessage: 'Posts' },
  followers: { id: 'kprofile.stats.followers', defaultMessage: 'Followers' },
  following: { id: 'kprofile.stats.following', defaultMessage: 'Following' },
  joined: { id: 'kprofile.meta.joined', defaultMessage: 'Joined {date}' },
  ownerBadge: { id: 'kprofile.owner_badge', defaultMessage: '◈ Owner' },
});

const formatJoinDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

// Common Mastodon custom-field name → icon glyph. Match is
// case-insensitive on the field name; unknown fields fall back to `▸`.
const FIELD_ICONS: Array<[RegExp, string]> = [
  [/^(website|url|link|site)$/i, '↗'],
  [/^(location|city|from|based)$/i, '◍'],
  [/^(email|mail)$/i, '✉'],
  [/^(pronouns?)$/i, '◆'],
];

const iconForField = (name: string): string => {
  for (const [re, glyph] of FIELD_ICONS) {
    if (re.test(name.trim())) return glyph;
  }
  return '▸';
};

// Pronouns often live in a custom field. When present we lift it out of
// the fields list and render it inline next to the handle (matches the
// prototype's `@tal · he/him` treatment).
const findPronouns = (fields: ApiAccountFieldJSON[]): string | null => {
  const pronouns = fields.find((f) => /^pronouns?$/i.test(f.name.trim()));
  if (!pronouns) return null;
  // value is server-sanitised HTML — strip tags for the inline pill.
  return pronouns.value.replace(/<[^>]+>/g, '').trim() || null;
};

const filterMetarowFields = (
  fields: ApiAccountFieldJSON[],
  hiddenNames: string[],
): ApiAccountFieldJSON[] => {
  const hidden = hiddenNames.map((n) => n.toLowerCase());
  return fields.filter((f) => {
    const name = f.name.trim().toLowerCase();
    if (/^pronouns?$/.test(name)) return false; // already inline in handle
    if (hidden.includes(name)) return false; // consumed by a Me-panel card
    return true;
  });
};

export const KProfileHeader: React.FC<{
  account: ApiAccountJSON;
  hiddenFieldNames?: string[];
}> = ({ account, hiddenFieldNames = [] }) => {
  const intl = useIntl();
  const isOwner = account.id === me;

  return (
    <header className='kprofile'>
      <div className='kprofile__cover' aria-hidden />

      <div className='kprofile__headwrap'>
        <img className='kprofile__avatar' src={account.avatar} alt='' />

        <div className='kprofile__identity'>
          <div className='kprofile__nameline'>
            <h1
              className='kprofile__name'
              // account.display_name is server-sanitised HTML with custom
              // emoji shortcodes replaced by <img> tags for animated
              // variants — safe to render.
              dangerouslySetInnerHTML={{
                __html: account.display_name || account.username,
              }}
            />
            {isOwner && (
              <a href='/settings/profile' className='kprofile__edit'>
                {intl.formatMessage(messages.edit)}
              </a>
            )}
          </div>

          <p className='kprofile__handle'>
            <span className='kprofile__handle-acct'>@{account.acct}</span>
            {findPronouns(account.fields) && (
              <span className='kprofile__pronouns'>
                {findPronouns(account.fields)}
              </span>
            )}
            {isOwner && (
              <span className='kprofile__owner'>
                {intl.formatMessage(messages.ownerBadge)}
              </span>
            )}
          </p>

          {account.note && (
            <div
              className='kprofile__bio'
              dangerouslySetInnerHTML={{ __html: account.note }}
            />
          )}

          <div className='kprofile__metarow'>
            {filterMetarowFields(account.fields, hiddenFieldNames).map(
              (field) => (
                <span
                  key={field.name}
                  className={`kprofile__meta-item${field.verified_at ? ' kprofile__meta-item--verified' : ''}`}
                >
                  <span className='kprofile__meta-icon' aria-hidden>
                    {iconForField(field.name)}
                  </span>
                  <span
                    className='kprofile__meta-value'
                    // field.value is server-sanitised HTML (may contain a
                    // verified <a> or an emoji <img>).
                    dangerouslySetInnerHTML={{ __html: field.value }}
                  />
                </span>
              ),
            )}
            <span className='kprofile__meta-item'>
              <span className='kprofile__meta-icon' aria-hidden>
                ✦
              </span>
              <FormattedMessage
                id='kprofile.meta.joined'
                defaultMessage='Joined {date}'
                values={{ date: formatJoinDate(account.created_at) }}
              />
            </span>
          </div>
        </div>

        <div className='kprofile__stats' role='list'>
          <div className='kprofile__stat' role='listitem'>
            <b>{account.statuses_count}</b>
            <span>{intl.formatMessage(messages.posts)}</span>
          </div>
          <div className='kprofile__stat' role='listitem'>
            <b>{account.followers_count}</b>
            <span>{intl.formatMessage(messages.followers)}</span>
          </div>
          <div className='kprofile__stat' role='listitem'>
            <b>{account.following_count}</b>
            <span>{intl.formatMessage(messages.following)}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
