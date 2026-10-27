# frozen_string_literal: true

class Api::V1::Accounts::SearchController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }
  before_action :require_user!

  def show
    @accounts = account_search
    render json: @accounts, each_serializer: REST::AccountSerializer
  end

  private

  # Kronk: members only (Kronk::Search::PolicyFilter#filter_accounts says
  # why). Filtered here rather than in the upstream service, which its own
  # specs (and upstream merges) expect to find remote accounts.
  def account_search
    members_only(AccountSearchService.new.call(
      params[:q],
      current_account,
      limit: limit_param(DEFAULT_ACCOUNTS_LIMIT),
      resolve: truthy_param?(:resolve),
      following: truthy_param?(:following),
      offset: params[:offset]
    ))
  end

  def members_only(accounts)
    accounts.select { |account| account.local? && !account.instance_actor? }
  end
end
