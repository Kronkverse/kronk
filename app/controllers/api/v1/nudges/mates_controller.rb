# frozen_string_literal: true

# GET /api/v1/nudges/mates — the current account's Mates (mutual
# follows). Powers the new-chat pencil's contact picker per
# docs/spaces/nudges.md (Nudges spec) §Surface 2. Same Mates gate as the router:
# both directions of the follow relationship must exist.
#
# `?q=` narrows by username or display name, names that start with it
# first. The picker searches through this rather than through the page it
# already holds: someone with more Mates than one page could never find the
# ones past it (Kommons #117430533432114595, Rose's picker not showing
# certain people). It is also every @-suggestion: you can only mention your
# Mates (Tal 2026-10-29, docs/spaces/feed.md, Mentions).
class Api::V1::Nudges::MatesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:follows' }
  before_action :require_user!

  DEFAULT_LIMIT = 60
  MAX_LIMIT     = 200

  def index
    limit = [params.fetch(:limit, DEFAULT_LIMIT).to_i, MAX_LIMIT].min

    # Canonical Mates set (mutual follow) — see Account#mate?/#mates.
    accounts = current_account.mates
    query    = params[:q].to_s.strip.delete_prefix('@')

    if query.present?
      like     = Account.sanitize_sql_like(query)
      accounts = accounts.where('accounts.username ILIKE :pattern OR accounts.display_name ILIKE :pattern', pattern: "%#{like}%")
                         .order(Arel.sql(Account.sanitize_sql_array(['(accounts.username ILIKE :prefix OR accounts.display_name ILIKE :prefix) DESC', { prefix: "#{like}%" }])))
    end

    render json: accounts.order(:username).limit(limit), each_serializer: REST::AccountSerializer
  end
end
