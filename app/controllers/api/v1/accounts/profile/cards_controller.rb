# frozen_string_literal: true

# Read-only listing of another account's visible profile cards. Powers
# the sectioned /@user profile Me tab — a viewer fetches the target
# account's cards here (not their own).
#
#   GET /api/v1/accounts/:account_id/profile/cards
#
# Cards are filtered per-viewer by ProfileCard#visible_to? — the wire
# never carries content the viewer isn't allowed to see. Only
# viewer-visible + `visible: true` + ordered cards come back.
class Api::V1::Accounts::Profile::CardsController < Api::BaseController
  before_action -> { authorize_if_got_token! :read, :'read:accounts' }
  before_action :require_composer_flag!
  before_action :set_account

  skip_before_action :require_authenticated_user!

  def index
    render json: filtered_cards, each_serializer: REST::ProfileCardSerializer
  end

  private

  def set_account
    @account = Account.find(params[:account_id])
  end

  def filtered_cards
    viewer = current_user&.account
    @account.profile_cards.shown.ordered.select { |c| c.visible_to?(viewer) }
  end

  def require_composer_flag!
    return if Kronk::FeatureFlags.enabled?(:profile_composer)

    render json: { error: 'profile_composer feature not enabled' }, status: 404
  end
end
