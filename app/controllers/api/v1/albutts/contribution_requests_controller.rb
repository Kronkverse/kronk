# frozen_string_literal: true

# Asking to add photos to an album (docs/spaces/albutts.md, Asking to add
# photos).
#
#   POST   /api/v1/albutts/albums/:album_id/contribution_requests
#            ask (anyone who can see the album but can't add to it)
#   GET    /api/v1/albutts/albums/:album_id/contribution_requests
#            who's asking (the owner)
#   POST   /api/v1/albutts/albums/:album_id/contribution_requests/:id/accept
#            let them add photos (the owner)
#   DELETE /api/v1/albutts/albums/:album_id/contribution_requests/:id
#            decline (the owner), or take back your own request
class Api::V1::Albutts::ContributionRequestsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, except: [:index]
  before_action :require_user!
  before_action :set_album

  def index
    authorize_owner!
    requests = @album.contribution_requests.includes(:account).order(created_at: :asc)
    render json: requests.map { |r| { id: r.id.to_s, created_at: r.created_at.iso8601, account: REST::AccountSerializer.new(r.account, scope: current_user, scope_name: :current_user).as_json } }
  end

  def create
    return render json: { error: 'already_contributor' }, status: 422 if @album.contributable_by?(current_account)
    # A Krew album is added to by joining the Krew, not by asking.
    return render json: { error: 'join_the_krew' }, status: 422 if @album.krew_album?

    request = @album.contribution_requests.find_or_create_by!(account: current_account)
    Kronk::AlbumContributionRequests.notify_requested(@album, current_account) if request.previously_new_record?
    render json: { id: request.id.to_s }
  rescue ActiveRecord::RecordNotUnique
    render json: { id: @album.contribution_requests.find_by!(account: current_account).id.to_s }
  end

  def accept
    authorize_owner!
    request = @album.contribution_requests.find(params[:id])
    @album.album_contributors.find_or_create_by!(account_id: request.account_id)
    request.destroy!
    Kronk::AlbumContributionRequests.notify_granted(@album, request.account)
    render_empty
  end

  def destroy
    request = @album.contribution_requests.find(params[:id])
    raise ActiveRecord::RecordNotFound unless request.account_id == current_account.id || @album.owner_id == current_account.id

    request.destroy!
    render_empty
  end

  private

  def set_album
    @album = Album.find(params[:album_id])
    raise ActiveRecord::RecordNotFound unless @album.visible_to?(current_account)
  end

  def authorize_owner!
    raise ActiveRecord::RecordNotFound unless @album.owner_id == current_account.id
  end
end
