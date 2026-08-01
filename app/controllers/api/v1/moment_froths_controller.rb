# frozen_string_literal: true

# Ephemeral favourites on a Moment. A member route on :moments
# (POST/DELETE /api/v1/moments/:id/froth). Idempotent: double-POST doesn't
# create duplicate rows (unique index catches it, controller rescues gracefully).
class Api::V1::MomentFrothsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:favourites' }
  before_action :require_user!
  before_action :set_moment

  def create
    @moment.moment_froths.find_or_create_by!(account: current_account)
    mark_moment_seen
    render json: @moment, serializer: REST::MomentSerializer
  rescue ActiveRecord::RecordNotUnique
    # Race between two clicks — the row exists; treat as success.
    mark_moment_seen
    render json: @moment, serializer: REST::MomentSerializer
  end

  def destroy
    froth = @moment.moment_froths.find_by(account: current_account)
    froth&.destroy!
    render json: @moment, serializer: REST::MomentSerializer
  end

  private

  # Frothing a Moment in the feed strip counts as seeing it, so the Moments
  # unread badge drops without opening the korner. Moments have no backing
  # Status, so the seen-set is keyed on the moment id under the 'moments' slug.
  # See Kronk::KornerSeen / Kronk::KornerContentStreams::MomentStream.
  def mark_moment_seen
    Kronk::KornerSeen.mark_seen(current_account, 'moments', @moment.id)
  end

  def set_moment
    # The member route supplies the moment id as `:id`; `:moment_id` kept as a
    # fallback for any nested caller. Reading only `:moment_id` here made every
    # froth 404 (Moment.find(nil)) — see the spec added alongside this.
    @moment = Moment.find(params[:id] || params[:moment_id])
  end
end
