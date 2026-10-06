# frozen_string_literal: true

class OAuthUserinfoSerializer < ActiveModel::Serializer
  include RoutingHelper

  attributes :iss, :sub, :name, :preferred_username, :profile, :picture

  def iss
    root_url
  end

  # Kronk: the account's id, not its ActivityPub URI. OpenID Connect needs
  # `sub` to identify a person forever and to match the id_token's `sub`
  # (config/initializers/doorkeeper_openid_connect.rb); the URI embeds the
  # domain, which Kronk has changed before.
  def sub
    object.id.to_s
  end

  def name
    object.display_name
  end

  def preferred_username
    object.username
  end

  def profile
    ActivityPub::TagManager.instance.url_for(object)
  end

  def picture
    full_asset_url(object.avatar_original_url)
  end
end
