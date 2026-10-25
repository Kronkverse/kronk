# frozen_string_literal: true

class REST::BoothShoutoutSerializer < ActiveModel::Serializer
  include RoutingHelper

  attributes :id, :body, :at_seconds, :created_at, :account, :can_remove

  def id
    object.id.to_s
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
