# frozen_string_literal: true

# GET /api/v1/nudges/mates — the current account's Mates (mutual
# follows). Powers the new-chat pencil's contact picker per
# docs/kronk_nudges.md §Surface 2. Same Mates gate as the router:
# both directions of the follow relationship must exist.
class Api::V1::Nudges::MatesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:follows' }
  before_action :require_user!

  DEFAULT_LIMIT = 60
  MAX_LIMIT     = 200

  def index
    limit = [params.fetch(:limit, DEFAULT_LIMIT).to_i, MAX_LIMIT].min

    # Canonical Mates set (mutual follow) — see Account#mate?/#mates.
    accounts = current_account.mates.order(:username).limit(limit)
    render json: accounts, each_serializer: REST::AccountSerializer
  end
end
