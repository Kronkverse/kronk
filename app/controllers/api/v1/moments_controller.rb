# frozen_string_literal: true

class Api::V1::MomentsController < Api::BaseController
  before_action :require_user!

  def index
    @statuses = Status.where(account: current_user.account, post_type: :moment)
                      .order(created_at: :desc)
                      .limit(40)
    render json: @statuses, each_serializer: REST::StatusSerializer, relationships: StatusRelationshipsPresenter.new(@statuses, current_user&.account_id)
  end
end
