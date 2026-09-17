# frozen_string_literal: true

# Personal privacy settings (settings rebuild §7). Read/write surface over
# the user's privacy toggles. Every field surfaced here is either an Account
# column (written via UpdateAccountService so the change federates) or a
# UserSettings key with a live consumer.
#
#   GET /api/v1/settings/privacy
#     => { settings_schema: [{ name:, kind:, options? }, ...], values: {...} }
#   PUT /api/v1/settings/privacy
#     body: { locked: true, kommunity_discoverability: 'orbit' }  (partial)
#
# Retired 2026-09-13: `indexable`, `show_application`,
# `dm_followers_only` — declared but had zero consumers in the app, so
# each was a toggle that did nothing. Underlying UserSettings keys stay
# for federation / admin compat; only the user-visible fields drop.
class Api::V1::Settings::PrivacyController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:update]
  before_action :require_user!

  # target: :account => an Account column (attr); :settings => a UserSettings key.
  # kind: 'boolean' | 'enum' — enum carries an ordered options array; the SPA
  # renders it as a dropdown, the coercer keeps the raw string value.
  FIELDS = {
    'locked' => { target: :account, attr: :locked, kind: 'boolean' },
    'discoverable' => { target: :account, attr: :discoverable, kind: 'boolean' },
    'kommunity_discoverability' => {
      target: :account,
      attr: :kommunity_discoverability,
      kind: 'enum',
      options: %w(everyone orbit nobody),
    },
    'profile_visibility' => {
      target: :account,
      attr: :profile_visibility,
      kind: 'enum',
      options: %w(public mates orbit self_only),
    },
    'hide_collections' => { target: :account, attr: :hide_collections, kind: 'boolean' },
  }.freeze

  def show
    render json: payload
  end

  def update
    account_updates = {}
    settings_updates = {}

    FIELDS.each do |name, cfg|
      next unless params.key?(name)

      value = coerce(cfg[:kind], params[name])
      if cfg[:target] == :account
        account_updates[cfg[:attr]] = value
      else
        settings_updates[cfg[:key]] = value
      end
    end

    begin
      UpdateAccountService.new.call(current_account, account_updates, raise_error: true) if account_updates.any?
      if settings_updates.any?
        current_user.settings.update(settings_updates)
        current_user.save!
      end
    rescue ActiveRecord::RecordInvalid, ArgumentError => e
      return render json: { error: e.message }, status: 422
    end

    render json: payload
  end

  private

  def coerce(kind, raw)
    case kind
    when 'boolean' then ActiveModel::Type::Boolean.new.cast(raw)
    else raw.to_s
    end
  end

  def payload
    {
      settings_schema: FIELDS.map do |name, cfg|
        entry = { name: name, kind: cfg[:kind] }
        entry[:options] = cfg[:options] if cfg[:options]
        entry
      end,
      values: {
        'locked' => current_account.locked,
        'discoverable' => current_account.discoverable,
        'kommunity_discoverability' => current_account.kommunity_discoverability,
        'profile_visibility' => current_account.profile_visibility,
        'hide_collections' => current_account.hide_collections,
      },
    }
  end
end
