# frozen_string_literal: true

# Kommunity — the viewer's one-way connections, for the foot of their own
# Mates list (`/@:acct/mates`). It took over from the Rails Follows and
# followers page (Tal, 2026-11-24: merge it into Mates).
#
#   GET /api/v1/kommunity/not_yet_mates
#
#   sent      people the viewer asked, or added before Mates, who haven't
#             added them back: pending Mate requests and one-way follows
#   received  people who added the viewer before Mates and were never added
#             back. Pending requests to the viewer aren't here; they're on
#             /mate_requests.
#
# Full `REST::AccountSerializer` records, so the page renders them with the
# shared account row and its Mate button (withdraw a request, or Mate back).
# Capped rather than paged: these lists are short by nature.
class Api::V1::Kommunity::NotYetMatesController < Api::BaseController
  LIMIT = 80

  before_action -> { doorkeeper_authorize! :read, :'read:follows' }
  before_action :require_user!

  def index
    render json: {
      sent: serialize(sent_scope),
      received: serialize(received_scope),
    }
  end

  private

  def sent_scope
    requested = current_account.follow_requests.select(:target_account_id)
    following = current_account.active_relationships.select(:target_account_id)
    Account.where(id: requested).or(Account.where(id: following)).where.not(id: current_account.mates.select(:id))
  end

  def received_scope
    Account.where(id: current_account.passive_relationships.select(:account_id))
           .where.not(id: current_account.active_relationships.select(:target_account_id))
  end

  def serialize(scope)
    accounts = scope.without_suspended.not_excluded_by_account(current_account)
                    .includes(:account_stat, :user).order(:username).limit(LIMIT)
    ActiveModel::Serializer::CollectionSerializer.new(accounts, serializer: REST::AccountSerializer)
  end
end
