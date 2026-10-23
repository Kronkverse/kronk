# frozen_string_literal: true

# An artist's portfolio in Art (docs/spaces/art.md, Portfolio).
#
#   GET /api/v1/art/portfolios/:id   anyone's portfolio (:id is the account)
#   PUT /api/v1/art/portfolio        your own: statement, open_for_commissions,
#                                    featured_ids (up to three of your pieces)
#
# The pieces are the ones the viewer may see (`ArtPiece.visible_to`), so a
# Mates-only piece is in a Mate's view of the portfolio and nobody else's. The
# statement and the commissions marker follow the profile: someone who can't
# see the artist's profile sees only the pieces that reach them.
class Api::V1::Art::PortfoliosController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:update]
  before_action :require_user!, only: [:update]

  PIECE_LIMIT = 60

  def show
    account = Account.find(params[:id])
    render json: portfolio_json(account)
  end

  def update
    portfolio = current_account.art_portfolio || current_account.build_art_portfolio
    portfolio.assign_attributes(portfolio_params.except(:featured_ids))

    if portfolio.save
      ArtPortfolio.feature!(current_account, portfolio_params[:featured_ids]) if portfolio_params.key?(:featured_ids)
      render json: portfolio_json(current_account)
    else
      render json: { error: portfolio.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  private

  def portfolio_params
    params.permit(:statement, :open_for_commissions, featured_ids: [], mediums: [])
  end

  def piece_json(piece)
    REST::ArtPieceSerializer.new(piece, scope: current_user, scope_name: :current_user).as_json
  end

  def portfolio_json(account)
    viewer = current_account
    profile_visible = account.profile_visible_to?(viewer)
    portfolio = account.art_portfolio
    visible = ArtPiece.visible_to(viewer).where(owner_id: account.id)
    pieces = visible.recent.limit(PIECE_LIMIT).to_a
    featured = visible.where.not(featured_position: nil).reorder(:featured_position).to_a

    {
      account: REST::AccountSerializer.new(account, scope: current_user, scope_name: :current_user).as_json,
      is_owner: account.id == viewer&.id,
      statement: profile_visible ? portfolio&.statement : nil,
      open_for_commissions: profile_visible && portfolio&.open_for_commissions == true,
      mediums: profile_visible ? (portfolio&.mediums || []) : [],
      # Whether the artist has saved one yet; until then their own portfolio
      # offers the guided set-up.
      set_up: portfolio.present?,
      featured: featured.map { |piece| piece_json(piece) },
      pieces: pieces.map { |piece| piece_json(piece) },
    }
  end
end
