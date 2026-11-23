# frozen_string_literal: true

# An app in Kollection (docs/spaces/kollection.md): something linked to
# Kronk, listed for every member.
#
# Two kinds, told apart by `oauth_application`:
#
# - **Signs in with Kronk.** It has a Doorkeeper application with no owner
#   (the app belongs to Kronk, not to a person), so it works with Kronk's
#   OAuth and OIDC sign-in exactly like one made at /settings/applications.
#   Its redirect URIs, scopes and client key and secret live there.
# - **A link.** No Kronk sign-in (yet): a door to an app that has its own,
#   like YOU. It needs a website.
#
# Any member can add one and it is live at once. The member who added it is
# its **keeper**: they (and admins) see its client key and secret, edit it
# and remove it. A keeper whose account is gone or suspended keeps nothing,
# and an admin can name a new one. Admins can **pull** an app: it leaves the
# list, every token it holds is revoked, and it can no longer sign anyone
# in (Kronk::KollectionClient) until it is restored.
class KollectionApp < ApplicationRecord
  # What an app may ask to see of you, in the order the composer offers
  # them. A small, plain set on purpose; Kronk's other scopes (admin ones
  # above all) are not offered here.
  SCOPES = %w(openid profile read write).freeze
  DEFAULT_SCOPES = %w(openid profile).freeze

  NAME_LIMIT = ApplicationExtension::APP_NAME_LIMIT
  DESCRIPTION_LIMIT = 500
  NOT_WEB_ADDRESS = 'must be a web address starting with http:// or https://'

  enum :status, { live: 0, pulled: 1 }, validate: true

  belongs_to :keeper, class_name: 'Account', optional: true
  belongs_to :oauth_application, class_name: 'Doorkeeper::Application', optional: true, autosave: true, inverse_of: :kollection_app
  belongs_to :icon_media_attachment, class_name: 'MediaAttachment', optional: true

  normalizes :name, with: ->(name) { name.to_s.squish }
  normalizes :description, with: ->(description) { description.to_s.strip }
  normalizes :website, with: ->(website) { website.to_s.strip.presence }

  validates :name, presence: true, length: { maximum: NAME_LIMIT }
  validates :description, length: { maximum: DESCRIPTION_LIMIT }
  validates :website, length: { maximum: ApplicationExtension::APP_WEBSITE_LIMIT }
  validate :website_is_web_address
  validate :link_has_website

  # What `account` sees in the list: every live app, and the ones it keeps
  # even while pulled, so a keeper can see what happened to theirs.
  scope :shown_to, ->(account) { live.or(where(keeper_id: account.id)) }

  def signs_in?
    oauth_application.present?
  end

  # The keeper, while their account can still keep anything.
  def current_keeper
    keeper if keeper.present? && !keeper.unavailable? && keeper.user.present?
  end

  def kept_by?(account)
    account.present? && current_keeper&.id == account.id
  end

  def scopes
    oauth_application ? oauth_application.scopes.to_a : []
  end

  def redirect_uris
    oauth_application&.redirect_uris || []
  end

  # Whether `user` holds a live token for it: they have signed in to it
  # with Kronk and not disconnected.
  def connected?(user)
    signs_in? && Doorkeeper::AccessToken.exists?(application_id: oauth_application_id, resource_owner_id: user.id, revoked_at: nil)
  end

  # The apps among `apps` that `user` is connected to, by oauth application id.
  def self.connected_application_ids(user, apps)
    ids = apps.filter_map(&:oauth_application_id)
    return Set.new if user.nil? || ids.empty?

    Doorkeeper::AccessToken.where(application_id: ids, resource_owner_id: user.id, revoked_at: nil).distinct.pluck(:application_id).to_set
  end

  # Ends `user`'s connection: their tokens and grants for it are revoked,
  # its push subscriptions on them stop and its live streams close.
  # Nobody else's are touched.
  def disconnect!(user)
    return unless signs_in?

    Web::PushSubscription.unsubscribe_for(oauth_application_id, user)
    oauth_application.close_streaming_sessions(user)
    Doorkeeper::Application.revoke_tokens_and_grants_for(oauth_application_id, user)
  end

  def pull!
    update!(status: :pulled, pulled_at: Time.current)
    revoke_everyone!
  end

  def restore!
    update!(status: :live, pulled_at: nil)
  end

  # Removes the app, and with its Doorkeeper application every token and
  # grant it held.
  def remove!
    transaction do
      application = oauth_application
      destroy!
      application&.destroy!
    end
  end

  private

  def revoke_everyone!
    return unless signs_in?

    now = Time.now.utc
    tokens = Doorkeeper::AccessToken.where(application_id: oauth_application_id)
    Web::PushSubscription.where(access_token_id: tokens.select(:id)).delete_all
    oauth_application.close_streaming_sessions
    tokens.where(revoked_at: nil).in_batches.update_all(revoked_at: now)
    Doorkeeper::AccessGrant.where(application_id: oauth_application_id, revoked_at: nil).in_batches.update_all(revoked_at: now)
  end

  def website_is_web_address
    return if website.blank?

    uri = URI.parse(website)
    errors.add(:website, NOT_WEB_ADDRESS) unless uri.is_a?(URI::HTTP) && uri.host.present?
  rescue URI::InvalidURIError
    errors.add(:website, NOT_WEB_ADDRESS)
  end

  def link_has_website
    errors.add(:website, 'is needed for an app that does not sign in with Kronk') if !signs_in? && website.blank?
  end
end
