# frozen_string_literal: true

# Kommunity — the three drawer layers (Tal 2026-08-28). Each action
# returns a page of accounts for one layer of the discover drawer:
#
#   GET /api/v1/kommunity/kronkers   # visible strangers (public)
#   GET /api/v1/kommunity/orbit      # mates of mates (fof)
#   GET /api/v1/kommunity/krews      # members of your krews
#
# All three exclude the viewer + the viewer's existing mates — the
# drawer is a *discovery* surface. Mates you already have belong on
# the profile's Mates tab, not here.
#
# Same paginated shape as the legacy `discover` action so the client
# can render each layer with one generic list widget.
class Api::V1::Kommunity::LayersController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }
  before_action :require_user!

  DEFAULT_LIMIT = 40
  MAX_LIMIT     = 80

  def kronkers
    scope = Account.kommunity_discoverable_by_everyone
                   .merge(base_discoverable_scope)
                   .where.not(id: current_account.mates.select(:id))
                   .by_recent_activity
                   .includes(:account_stat, user: :role)

    render json: paginate(scope), each_serializer: REST::AccountSerializer
  end

  def orbit
    # Mates-of-mates: every account followed by one of my mates,
    # minus me + my direct mates. Filtered by the account's own
    # `orbit`-visibility (they opted into being findable by fof).
    fof_ids = Follow.where(account_id: current_account.mates.select(:id))
                    .where.not(target_account_id: current_account.id)
                    .select(:target_account_id)

    scope = Account.kommunity_discoverable_by_orbit
                   .merge(base_discoverable_scope)
                   .where(id: fof_ids)
                   .where.not(id: current_account.mates.select(:id))
                   .by_recent_activity
                   .includes(:account_stat, user: :role)

    render json: paginate(scope), each_serializer: REST::AccountSerializer
  end

  def krews
    # Everyone who shares a Krew with me, deduped across krews. No
    # discoverability filter — sharing a Krew is a deliberate act
    # that already reads as an intro on both sides.
    my_krew_ids = current_account.krews.select(:id)
    member_ids  = KrewMembership.where(krew_id: my_krew_ids).select(:account_id)

    scope = Account.local
                   .without_suspended
                   .without_silenced
                   .without_memorial
                   .where(moved_to_account_id: nil)
                   .where(id: member_ids)
                   .where.not(id: current_account.id)
                   .where.not(id: current_account.mates.select(:id))
                   .distinct
                   .by_recent_activity
                   .includes(:account_stat, user: :role)

    render json: paginate(scope), each_serializer: REST::AccountSerializer
  end

  private

  # The bits every layer wants: local, not suspended / silenced /
  # memorial / moved, has actually signed in at least once.
  # Deliberately identical to the guard block inside
  # `Account.kommunity_discoverable_to` so the "who is a real
  # community member" answer stays in sync across all four surfaces
  # (three layers + the legacy discover endpoint).
  def base_discoverable_scope
    Account.local
           .without_suspended
           .without_silenced
           .without_memorial
           .where(moved_to_account_id: nil)
           .where(id: User.approved.enabled.ever_signed_in.select(:account_id))
           .where.not(id: current_account.id)
           .where.not(id: current_account.excluded_from_timeline_account_ids)
  end

  def paginate(scope)
    scope = scope.where(Account.arel_table[:id].lt(params[:max_id])) if params[:max_id].present?
    scope = scope.where(Account.arel_table[:id].gt(params[:since_id])) if params[:since_id].present?
    scope.limit(clamp_limit)
  end

  def clamp_limit
    [params.fetch(:limit, DEFAULT_LIMIT).to_i, MAX_LIMIT].min.clamp(1, MAX_LIMIT)
  end
end
