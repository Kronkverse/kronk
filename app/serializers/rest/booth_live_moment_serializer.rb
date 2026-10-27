# frozen_string_literal: true

# A moment in a live set (BoothLiveMoment): who, what, and how far into the
# set. `text` is what goes on screen and into the call.
class REST::BoothLiveMomentSerializer < ActiveModel::Serializer
  include RoutingHelper

  attributes :id, :kind, :body, :artist, :title, :text, :at_seconds, :created_at, :account, :can_remove

  def id
    object.id.to_s
  end

  def account
    {
      id: object.account.id.to_s,
      acct: object.account.acct,
      username: object.account.username,
      display_name: object.account.display_name.presence || object.account.username,
      avatar: full_asset_url(object.account.avatar_static_url),
    }
  end

  # Its author, the set's host or a steward.
  def can_remove
    return false unless current_user

    [object.account_id, object.booth_live.account_id].include?(current_user.account_id) ||
      current_user.role&.can?(:manage_reports) || false
  end
end
