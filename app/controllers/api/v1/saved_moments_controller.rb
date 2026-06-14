# frozen_string_literal: true

class Api::V1::SavedMomentsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:bookmarks' }
  before_action :require_user!

  def index
    statuses = Status.joins(:bookmarks)
                     .where(bookmarks: { account: current_user.account })
                     .where(post_type: :moment)
                     .order('bookmarks.id DESC')
                     .limit(40)
    render json: statuses,
           each_serializer: REST::StatusSerializer,
           relationships: StatusRelationshipsPresenter.new(statuses, current_user.account_id)
  end
end
