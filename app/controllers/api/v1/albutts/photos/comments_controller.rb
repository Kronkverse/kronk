# frozen_string_literal: true

# Comments on a single AlbumPhoto — the discussion surface inside the
# lightbox. Nested under a photo; one level of threading (`parent_id`),
# mirroring Kommons proposal comments.
class Api::V1::Albutts::Photos::CommentsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :destroy]
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index]
  before_action :require_user!
  before_action :set_photo
  before_action :authorize_view!
  before_action :set_comment, only: [:destroy]

  def index
    @comments = @photo.comments.roots.chronological
                      .includes(:account, replies: :account)
    render json: @comments, each_serializer: REST::AlbumPhotoCommentSerializer
  end

  def create
    @comment = @photo.comments.new(comment_params.merge(account: current_account))

    if @comment.save
      render json: @comment, serializer: REST::AlbumPhotoCommentSerializer, status: 201
    else
      render json: { error: @comment.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def destroy
    @comment.destroy!
    render_empty
  end

  private

  def set_photo
    @photo = AlbumPhoto.find(params[:photo_id])
  end

  def set_comment
    @comment = @photo.comments.find(params[:id])
    return if @comment.account_id == current_account.id || @photo.album.owner_id == current_account.id

    render json: { error: 'Only the author or album owner can delete this comment.' }, status: 403 # rubocop:disable I18n/RailsI18n/DecorateString
  end

  def authorize_view!
    raise Mastodon::NotPermittedError unless @photo.album.visible_to?(current_account)
  end

  def comment_params
    params.expect(comment: [:body, :parent_id])
  end
end
