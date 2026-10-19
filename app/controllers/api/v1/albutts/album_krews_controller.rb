# frozen_string_literal: true

# Link an album you made to a Krew you're in, or unlink it
# (docs/spaces/krew.md, Linking). The Krew joins the album's audience, and
# its posts so far: the album post and every photo's.
#
#   POST   /api/v1/albutts/albums/:album_id/krews      (krew_id)
#   DELETE /api/v1/albutts/albums/:album_id/krews/:id
class Api::V1::Albutts::AlbumKrewsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }
  before_action :require_user!
  before_action :set_album

  def create
    krew = current_account.krews.find(params[:krew_id])
    return render json: { error: 'krew is archived' }, status: 422 if krew.archived?

    @album.album_krews.find_or_create_by!(krew: krew)
    Kronk::StatusKrews.add(@album.post_status_ids, krew.id)
    render_empty
  end

  def destroy
    @album.album_krews.where(krew_id: params[:id]).destroy_all
    Kronk::StatusKrews.remove(@album.post_status_ids, params[:id])
    render_empty
  end

  private

  def set_album
    # A Krew album already belongs to its Krew; only personal albums link.
    @album = current_account.owned_albums.where(krew_id: nil).find(params[:album_id])
  end
end
