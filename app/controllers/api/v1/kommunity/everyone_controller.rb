# frozen_string_literal: true

# Kommunity — Everyone, the full directory of Kronkers who chose to be
# visible to the viewer. Tal's Kommons proposal "Landing Page"
# (#117483791865274639): "having a straight up list should be a middle
# page, with a full list of 'Visible' Users (if they choose to be
# visible)".
#
#   GET /api/v1/kommunity/everyone?q=&limit=&offset=
#
# Who is on it (docs/spaces/kommunity.md, Everyone) is exactly
# `Account.kommunity_discoverable_to(viewer)`: findability `everyone`, or
# `orbit` when the viewer is in their Orbit (a Mate, or a Mate of one of
# their Mates). Findability `nobody` never appears, Mates or not. That
# scope also carries the active-member guard (local, not suspended /
# silenced / memorial / moved, has signed in) and leaves out the viewer
# and anyone blocked or muted either way. Mates who chose to be visible
# are listed, unlike Discover.
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
    Account.kommunity_discoverable_to(current_account)
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
