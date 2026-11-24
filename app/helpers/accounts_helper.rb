# frozen_string_literal: true

module AccountsHelper
  def display_name(account, **options)
    str = account.display_name.presence || account.username

    if options[:custom_emojify]
      prerender_custom_emojis(h(str), account.emojis)
    else
      str
    end
  end

  def acct(account)
    if account.local?
      "@#{account.acct}@#{site_hostname}"
    else
      "@#{account.pretty_acct}"
    end
  end

  def account_formatted_stat(value)
    number_to_human(value, precision: 3, strip_insignificant_zeros: true)
  end

  def account_description(account)
    prepend_str = [
      [
        account_formatted_stat(account.statuses_count),
        I18n.t('accounts.posts', count: account.statuses_count),
      ].join(' '),

      [
        account_formatted_stat(account.following_count),
        I18n.t('accounts.following', count: account.following_count),
      ].join(' '),

      [
        account_formatted_stat(account.followers_count),
        I18n.t('accounts.followers', count: account.followers_count),
      ].join(' '),
    ].join(', ')

    [prepend_str, account.note].join(' · ')
  end

  # Mates the viewer and this account have in common (Matuals), with up to
  # `limit` of them to show. Same privacy as the app's Matuals
  # (Api::V1::Accounts::MatualsController): hidden Mates show nothing.
  def matuals_with(viewer, account, limit: 3)
    return [0, []] if viewer.nil? || viewer.id == account.id || account.hides_followers?

    scope = viewer.mates.where(id: account.mates.select(:id)).not_excluded_by_account(viewer)
    [scope.count, scope.limit(limit).to_a]
  end

  def matuals_line(count, shown)
    return t('accounts.matuals.none') if count.zero?

    names = shown.map { |mate| display_name(mate) }
    names = count > shown.size ? t('accounts.matuals_more', names: names.join(', '), rest: count - shown.size) : names.to_sentence
    t('accounts.matuals', count: count, names: names)
  end
end
