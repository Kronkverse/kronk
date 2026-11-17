# frozen_string_literal: true

class REST::BoothShoutoutSerializer < ActiveModel::Serializer
  include RoutingHelper

  attributes :id, :body, :at_seconds, :booth_set_track_id, :created_at, :account, :can_remove

  def id
    object.id.to_s
  end

  # On an album the moment is in one of its tracks. A shoutout whose track
  # has since come off the album is no longer pinned anywhere.
  def at_seconds
    return nil if object.booth_set.album? && object.booth_set_track_id.nil?

    object.at_seconds
  end

  def booth_set_track_id
    object.booth_set_track_id&.to_s
  end

  def account
    {
      id: object.account.id.to_s,
      username: object.account.username,
      acct: object.account.acct,
      display_name: object.account.display_name.presence || object.account.username,
      avatar: full_asset_url(object.account.avatar_static_url),
    }
  end

  # The author, the set's owner, or a steward.
  def can_remove
    return false unless current_user

    [object.account_id, object.booth_set.account_id].include?(current_user.account_id) ||
      current_user.role&.can?(:manage_reports) || false
  end
end
