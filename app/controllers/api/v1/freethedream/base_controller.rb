# frozen_string_literal: true

# Shared ground for FreeTheDream's API (docs/spaces/freethedream.md, "The
# mechanism"). Everything needs a signed-in member; each controller checks
# who may do what against Freethedream::Project / Item.
class Api::V1::Freethedream::BaseController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, if: -> { request.get? }
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, unless: -> { request.get? }
  before_action :require_user!

  private

  def view
    @view ||= Freethedream::View.new(current_account)
  end

  def permit!(allowed)
    raise Mastodon::NotPermittedError unless allowed
  end

  def require_member!(project)
    permit!(project.member?(current_account))
  end

  def render_invalid(record)
    render json: { error: record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  # Hand something you own to another member of the project.
  def hand_over!(record, top)
    permit!(record.owned_by?(current_account))
    recipient = Account.find(params.require(:account_id))
    permit!(top.member?(recipient))
    record.update!(owner: recipient)
  end

  # Take over something whose owner has left the project.
  def take_over!(record, top)
    permit!(top.member?(current_account) && record.up_for_grabs?)
    record.update!(owner: current_account)
  end
end
