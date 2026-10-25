# frozen_string_literal: true

# Kommunity — Everyone, the full directory of Kronkers the viewer may find
# (Tal 2026-10-26: "build the list"). One alphabetical list, unlike the
# Discover layers, which are for meeting people you don't know yet:
#
#   GET /api/v1/kommunity/everyone?q=&limit=&offset=
#
# Who is on it (docs/spaces/kommunity.md, Everyone):
#
#   • anyone whose `kommunity_discoverability` lets the viewer find them
#     (`Account.kommunity_discoverable_to`: `everyone`, or `orbit` when the
#     viewer is a Mate of one of their Mates — the same Orbit test the
#     Discover layers use),
#   • the viewer's own Mates, and
#   • people who share a Krew with the viewer,
#
# whatever those last two chose for findability: they already know each
# other. Mates are included here, which is the difference from Discover.
# Everyone else is the same active-member guard the layers use (local, not
# suspended / silenced / memorial / moved, has signed in), minus the viewer
# and anyone blocked or muted either way.
#
# Ordered by display name, falling back to username, so it reads as a
# directory. An alphabetical order has no id cursor, so it pages by
# `offset`, with the next page in the Link header (rel="next").
class Api::V1::Kommunity::EveryoneController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }
  before_action :require_user!
  before_action :require_valid_pagination_options!
  after_action :insert_pagination_headers

  DEFAULT_LIMIT = 40
  MAX_LIMIT     = 80
  MAX_QUERY     = 100

  NAME_ORDER = Arel.sql("lower(coalesce(nullif(accounts.display_name, ''), accounts.username)) ASC, accounts.id ASC")

  def index
    @accounts = searched(visible_scope)
                .reorder(NAME_ORDER)
                .includes(:account_stat, user: :role)
                .offset(offset_param)
                .limit(clamp_limit)
                .to_a

    render json: @accounts, each_serializer: REST::AccountSerializer
  end

  private

  def visible_scope
    base = base_scope

    base.where(id: Account.kommunity_discoverable_to(current_account).select(:id))
        .or(base.where(id: current_account.mates.select(:id)))
        .or(base.where(id: krew_member_ids))
  end

  # Same guard as LayersController#base_discoverable_scope and
  # `Account.kommunity_discoverable_to`: who counts as a community member.
  # `excluded_from_timeline_account_ids` is blocks both ways plus mutes.
  def base_scope
    Account.local
           .without_suspended
           .without_silenced
           .without_memorial
           .where(moved_to_account_id: nil)
           .where(id: User.approved.enabled.ever_signed_in.select(:account_id))
           .where.not(id: current_account.id)
           .where.not(id: current_account.excluded_from_timeline_account_ids)
  end

  def krew_member_ids
    KrewMembership.where(krew_id: current_account.krews.select(:id)).select(:account_id)
  end

  def searched(scope)
    return scope if query.blank?

    pattern = "%#{Account.sanitize_sql_like(query)}%"
    table   = Account.arel_table

    scope.where(table[:display_name].matches(pattern).or(table[:username].matches(pattern)))
  end

  def query
    @query ||= params[:q].to_s.strip.first(MAX_QUERY)
  end

  def offset_param
    params[:offset].to_i
  end

  def clamp_limit
    [params.fetch(:limit, DEFAULT_LIMIT).to_i, MAX_LIMIT].min.clamp(1, MAX_LIMIT)
  end

  def next_path
    return unless @accounts && @accounts.size == clamp_limit

    api_v1_kommunity_everyone_url({ limit: clamp_limit, offset: offset_param + clamp_limit, q: query.presence }.compact)
  end

  def prev_path
    return if offset_param.zero?

    api_v1_kommunity_everyone_url({ limit: clamp_limit, offset: [offset_param - clamp_limit, 0].max, q: query.presence }.compact)
  end
end
