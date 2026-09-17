# frozen_string_literal: true

# "Who can see this?" — the audience readout for a status, owner-only
# (docs/rebuild/per_post_audience.md). Returns the resolved audience: the reach
# tier, any targeted krews, and the explicitly added / removed people. The
# author is the only one who can see the full picture of their own post.
#
#   GET /api/v1/statuses/:status_id/audience
class Api::V1::Statuses::AudiencesController < Api::V1::Statuses::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }
  before_action :require_user!
  before_action :require_ownership!

  def show
    render json: audience_json
  end

  private

  # Only the author sees who can see their post. Not-found (not 403) so the
  # endpoint doesn't confirm a status exists to non-owners.
  def require_ownership!
    not_found unless @status.account_id == current_account.id
  end

  def audience_json
    {
      visibility: @status.visibility,
      # Only meaningful for the `mates` tier — a concrete count the UI can show
      # ("Your Mates (23)"). `orbit` is unbounded/graph-dynamic and `public` is
      # everyone, so both are described in words client-side, not counted here.
      mates_count: @status.mates_visibility? ? current_account.mates.count : nil,
      krews: @status.krews.map { |krew| { id: krew.id.to_s, name: krew.name, slug: krew.slug } },
      added: serialize_accounts(@status.granted_accounts),
      removed: serialize_accounts(@status.excluded_accounts),
    }
  end

  def serialize_accounts(accounts)
    ActiveModelSerializers::SerializableResource.new(
      accounts,
      each_serializer: REST::AccountSerializer,
      scope: current_user,
      scope_name: :current_user
    ).as_json
  end
end
