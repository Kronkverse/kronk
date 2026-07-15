# frozen_string_literal: true

# Manages the current account's identity cards (the /@user Me-tab
# content) — the writer side of ProfileCard.
#
#   GET    /api/v1/profile/cards                # current account's cards in order
#   PUT    /api/v1/profile/cards/:card_type     # upsert (create-if-missing) card by its type
#   PATCH  /api/v1/profile/cards/reorder        # replace all positions (payload: {order: [card_type, card_type, ...]})
#   DELETE /api/v1/profile/cards/:card_type     # remove a card
#
# Cards are keyed by `card_type` in the URL (rather than numeric id) so
# the composer can upsert against a stable slug — the frontend already
# knows the card_type before the row exists.
class Api::V1::Profile::CardsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read,  :'read:accounts' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:update, :destroy, :reorder]
  before_action :require_user!
  before_action :require_composer_flag!

  def index
    render json: cards_scope, each_serializer: REST::ProfileCardSerializer
  end

  # Upsert — the composer writes cards by card_type. Creates a new row
  # if none exists for this account+type; updates the existing one
  # otherwise.
  def update
    card_type = params[:card_type]

    return render json: { error: "unknown card_type: #{card_type}" }, status: 422 unless ProfileCard::CARD_TYPES.include?(card_type)

    card = current_account.profile_cards.find_or_initialize_by(card_type: card_type)
    card.assign_attributes(card_update_params)
    card.position = next_position if card.new_record? && !params.key?(:position)

    if card.save
      render json: card, serializer: REST::ProfileCardSerializer
    else
      render json: { error: card.errors.full_messages.join(', ') }, status: 422
    end
  end

  def destroy
    card = current_account.profile_cards.find_by!(card_type: params[:card_type])
    card.destroy!
    render json: { ok: true }
  end

  # Batch reorder — payload {order: [card_type, card_type, ...]}. Every
  # listed card_type must belong to the current account; unknown types
  # abort the whole reorder.
  def reorder
    types = Array(params[:order]).map(&:to_s)
    owned = current_account.profile_cards.where(card_type: types).index_by(&:card_type)

    return render json: { error: 'unknown card_types in order' }, status: 422 if owned.size != types.size

    ProfileCard.transaction do
      types.each_with_index do |type, i|
        owned[type]&.update!(position: i)
      end
    end

    render json: cards_scope, each_serializer: REST::ProfileCardSerializer
  end

  private

  def cards_scope
    current_account.profile_cards.ordered
  end

  def next_position
    (current_account.profile_cards.maximum(:position) || -1) + 1
  end

  def card_update_params
    params.permit(:body, :visibility, :position, :visible)
  end

  def require_composer_flag!
    return if Kronk::FeatureFlags.enabled?(:profile_composer)

    render json: { error: 'profile_composer feature not enabled' }, status: 404
  end
end
