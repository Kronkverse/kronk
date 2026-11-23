# frozen_string_literal: true

# An app in Kollection (docs/spaces/kollection.md), as the viewer may see
# it. Every member gets what it is, what it can see of them (`scopes`),
# whether they are connected to it, and who keeps it. Its keeper and admins
# (`can_manage`) also get its redirect URIs and its client key and secret.
#
# One app's page (`detail: true`) adds its screenshots and the viewer's
# Mates who use it (KollectionApp#mates_using): only ever the viewer's own
# Mates, and only those who let their Mates see it.
#
# instance_options:
#   viewer         the signed-in account
#   detail         one app's page
#   connected_ids  oauth application ids the viewer holds a live token for
#                  (KollectionApp.connected_application_ids)
class REST::KollectionAppSerializer < ActiveModel::Serializer
  attributes :id, :slug, :name, :tagline, :description, :website, :made_by,
             :category, :platforms, :icon_url, :cover_url, :signs_in,
             :scopes, :status, :connected, :can_manage, :keeper, :created_at

  attribute :screenshots, if: :detail?
  attribute :mates_using, if: :detail?

  # Whether the viewer keeps it.
  attribute :is_keeper do
    object.kept_by?(viewer)
  end

  attribute :icon_id, if: :can_manage
  attribute :cover_id, if: :can_manage
  attribute :redirect_uris, if: :can_manage
  attribute :client_id, if: :secrets?
  attribute :client_secret, if: :secrets?

  def id
    object.id.to_s
  end

  def icon_url
    object.icon_media_attachment&.file&.url(:small)
  end

  def icon_id
    object.icon_media_attachment_id&.to_s
  end

  def cover_url
    object.cover_media_attachment&.file&.url(:original)
  end

  def cover_id
    object.cover_media_attachment_id&.to_s
  end

  def screenshots
    object.screenshots.includes(:media_attachment).filter_map do |shot|
      media = shot.media_attachment
      next if media.nil?

      { id: media.id.to_s, url: media.file.url(:original), preview_url: media.file.url(:small), description: media.description }
    end
  end

  def mates_using
    object.mates_using(viewer).map { |account| face(account) }
  end

  def detail?
    instance_options[:detail].present?
  end

  def signs_in
    object.signs_in?
  end

  def scopes
    object.scopes
  end

  def connected
    object.signs_in? && connected_ids.include?(object.oauth_application_id)
  end

  def can_manage
    policy.manage?
  end

  def secrets?
    can_manage && object.signs_in?
  end

  def redirect_uris
    object.redirect_uris
  end

  def client_id
    object.oauth_application.uid
  end

  def client_secret
    object.oauth_application.secret
  end

  def keeper
    account = object.current_keeper
    face(account) unless account.nil?
  end

  private

  def viewer
    instance_options[:viewer]
  end

  def connected_ids
    instance_options[:connected_ids] || Set.new
  end

  def policy
    @policy ||= KollectionAppPolicy.new(viewer, object)
  end

  def face(account)
    ActiveModelSerializers::SerializableResource
      .new(account, serializer: REST::AccountSerializer)
      .as_json
      .slice(:id, :acct, :username, :display_name, :avatar, :avatar_static)
  end
end
