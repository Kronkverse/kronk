# frozen_string_literal: true

# DELETE /api/v1/statuses/:status_id/profile_post
#
# Take a Mate's post off your profile (docs/spaces/profile.md, Posts from
# Mates). Only the profile's owner can. The post is not deleted: it is
# still its author's, it just no longer sits on your profile.
class Api::V1::Statuses::ProfilePostsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }
  before_action :require_user!

  def destroy
    status = Status.find(params[:status_id])
    raise Mastodon::NotPermittedError unless status.profile_account_id == current_account.id

    status.update!(profile_account_id: nil)
    render json: status, serializer: REST::StatusSerializer
  end
end
