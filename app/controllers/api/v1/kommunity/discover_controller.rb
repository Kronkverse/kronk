# frozen_string_literal: true

# Kommunity — Discover list. Returns local Kronk accounts the viewer
# is allowed to see, per each account's own `kommunity_discoverability`
# scope (docs/spaces/kommunity.md — new list surface, 2026-08-05).
#
#   GET /api/v1/kommunity/discover?limit=&max_id=&since_id=
#
# Signed-in only; anonymous visitors 401 (the surface is a signed-in
# affordance for finding other Kronk members). Ordered by recent
# activity — active accounts surface first, ghost accounts sink.
class Api::V1::Kommunity::DiscoverController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }
  before_action :require_user!

  DEFAULT_LIMIT = 40
  MAX_LIMIT     = 80

  def index
    @accounts = load_accounts
    render json: @accounts, each_serializer: REST::AccountSerializer
  end

  private

  def load_accounts
    scope = Account.kommunity_discoverable_to(current_account)
                   .by_recent_activity
                   .includes(:account_stat, user: :role)

    scope = scope.where(arel_table[:id].lt(params[:max_id])) if params[:max_id].present?
    scope = scope.where(arel_table[:id].gt(params[:since_id])) if params[:since_id].present?

    scope.limit(clamp_limit)
  end

  def arel_table
    Account.arel_table
  end

  def clamp_limit
    [params.fetch(:limit, DEFAULT_LIMIT).to_i, MAX_LIMIT].min.clamp(1, MAX_LIMIT)
  end
end
