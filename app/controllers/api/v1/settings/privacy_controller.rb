# frozen_string_literal: true

# Personal privacy settings (settings rebuild §7). Read/write surface over
# the user's privacy toggles. Unlike AppearanceController these span two
# stores: follow-approval + discoverability are Account columns (written via
# UpdateAccountService so the change federates), while the DM gate is a
# UserSettings key. FIELDS carries a  discriminator; #show returns
# the schema + current values so the SPA renders it with the shared widgets.
#
#   GET /api/v1/settings/privacy
#     => { settings_schema: [{ name:, kind:, options? }, ...], values: {...} }
#   PUT /api/v1/settings/privacy
#     body: { locked: true, dm_followers_only: false }  (partial)
class Api::V1::Settings::PrivacyController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:update]
  before_action :require_user!

  # target: :account => an Account column (attr); :settings => a UserSettings key.
  FIELDS = {
    'locked' => { target: :account, attr: :locked, kind: 'boolean' },
    'discoverable' => { target: :account, attr: :discoverable, kind: 'boolean' },
    'indexable' => { target: :settings, key: 'indexable', kind: 'boolean' },
    'hide_collections' => { target: :account, attr: :hide_collections, kind: 'boolean' },
    'show_application' => { target: :settings, key: 'show_application', kind: 'boolean' },
    'dm_followers_only' => { target: :settings, key: 'interactions.must_be_following_dm', kind: 'boolean' },
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
    kind == 'boolean' ? ActiveModel::Type::Boolean.new.cast(raw) : raw.to_s
  end

  def payload
    {
      settings_schema: FIELDS.map { |name, cfg| { name: name, kind: cfg[:kind] } },
      values: {
        'locked' => current_account.locked,
        'discoverable' => current_account.discoverable,
        'indexable' => current_user.settings['indexable'],
        'hide_collections' => current_account.hide_collections,
        'show_application' => current_user.settings['show_application'],
        'dm_followers_only' => current_user.settings['interactions.must_be_following_dm'],
      },
    }
  end
end
