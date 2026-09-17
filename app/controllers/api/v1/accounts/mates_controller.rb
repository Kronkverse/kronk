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
# Not to be confused with two neighbours:
#
#   * `Api::V1::Accounts::MatualsController` — mates in *common* between the
#     viewer and the target, returned as a capped preview for the profile card.
#   * `Api::V1::Mates::TimelinesController` — the whole graph slice (members +
#     bonds + invite lineage) that the Mates page used before it became a list.
#
# Privacy follows the followers list exactly: `hide_collections` hides the
# list from everyone but the owner, blocked viewers see nothing, and accounts
# the viewer has muted/blocked are filtered out of the results.
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
    scope = scope.not_excluded_by_account(current_account) unless current_account.nil? || current_account.id == @account.id
    scope.merge(paginated_follows).to_a
  end

  def hide_results?
    @account.unavailable? || (@account.hides_followers? && current_account&.id != @account.id) || (current_account && @account.blocking?(current_account))
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
