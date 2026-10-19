# frozen_string_literal: true

# Queued for every photo added to an album, QUIET after it. Only the job for
# a burst's last photo finds it quiet and posts it; the rest find nothing
# to do (Albutts::PublishPhotoBatch).
class Albutts::PublishPhotoBatchWorker
  include Sidekiq::Worker

  sidekiq_options retry: 3

  def perform(album_id, account_id)
    album = Album.find_by(id: album_id)
    account = Account.find_by(id: account_id)
    return if album.nil? || account.nil? || account.suspended?

    Albutts::PublishPhotoBatch.new(album, account).call
  end
end
