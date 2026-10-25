# frozen_string_literal: true

# Kronk — Mates. A paginated list of one account's Mates, where a Mate is a
# mutual follow (`Account#mate?`). This is the list behind `/@:acct/mates`.
#
#   GET /api/v1/accounts/:account_id/mates
#
# Returns full `REST::AccountSerializer` records, so the client renders them
# with the shared account row (relationship button, menu, verified badge)
# exactly like every other people-list on Kronk.
#
# Not to be confused with its neighbour:
#
#   * `Api::V1::Accounts::MatualsController` — mates in *common* between the
#     viewer and the target, returned as a capped preview for the profile card.
#
# Who sees it (Tal, 2026-10-26, docs/spaces/profile.md): the member
# themselves and their Mates, nobody else. Anyone else, signed out included,
# gets an empty list (the count, `mates_count`, stays public on the profile).
# A Mate can still be shut out: `hide_collections` hides the list from
# everyone but the owner, a viewer the member blocks sees nothing, and so
# does one who may not see the profile (`Account#profile_visible_to?`).
# Accounts the viewer has muted or blocked are filtered out of the results.
class Api::V1::Accounts::MatesController < Api::BaseController
  before_action -> { authorize_if_got_token! :read, :'read:accounts' }
  before_action :set_account
  after_action :insert_pagination_headers

  def index
    cache_if_unauthenticated!
    @accounts = load_accounts
    render json: @accounts, each_serializer: REST::AccountSerializer
  end

  private

  def set_account
    @account = Account.find(params[:account_id])
  end

  def load_accounts
    return [] if hide_results?

    scope = default_accounts
    scope = scope.not_excluded_by_account(current_account) unless owner?
    scope.merge(paginated_follows).to_a
  end

  def hide_results?
    return true if @account.unavailable?
    return false if owner?
    return true if current_account.nil? || @account.hides_followers?

    !@account.mate?(current_account) || !@account.profile_visible_to?(current_account)
  end

  def owner?
    current_account.present? && current_account.id == @account.id
  end

  # Mates are the mutual half of the followers list. Starting from the same
  # base as `FollowerAccountsController` — accounts whose follow targets
  # @account — keeps the Follow-row pagination below working unchanged; the
  # `where(id:)` clause then drops anyone @account does not follow back.
  def default_accounts
    Account
      .where(id: @account.active_relationships.select(:target_account_id))
      .includes(:active_relationships, :account_stat, :user)
      .references(:active_relationships)
  end

  def paginated_follows
    Follow.where(target_account: @account).paginate_by_max_id(
      limit_param(DEFAULT_ACCOUNTS_LIMIT),
      params[:max_id],
      params[:since_id]
    )
  end

  def next_path
    api_v1_account_mates_url pagination_params(max_id: pagination_max_id) if records_continue?
  end

  def prev_path
    api_v1_account_mates_url pagination_params(since_id: pagination_since_id) unless @accounts.empty?
  end

  def pagination_max_id
    @accounts.last.active_relationships.first.id
  end

  def pagination_since_id
    @accounts.first.active_relationships.first.id
  end

  def records_continue?
    @accounts.size == limit_param(DEFAULT_ACCOUNTS_LIMIT)
  end
end
