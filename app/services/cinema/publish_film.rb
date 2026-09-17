# frozen_string_literal: true

# Cinema::PublishFilm — creates the companion Status that renders as
# the `cinema_card` in the feed. Called from
# Api::V1::Cinema::FilmsController#create; idempotent so a re-invocation
# is a no-op if the film already has a status_id.
#
# One card per film lifetime. Same pattern as Art::PublishPiece /
# Kronikles::PublishChronicle / Albutts::PublishAlbum.
module Cinema
  class PublishFilm
    FILM_TO_STATUS_VISIBILITY = {
      'public' => 'public',
      'mates' => 'mates',
      'orbit' => 'orbit',
      'self_only' => 'self_only',
    }.freeze

    def initialize(film)
      @film = film
    end

    def call
      return @film if @film.status_id.present?

      status = PostStatusService.new.call(
        @film.owner,
        text: @film.title,
        visibility: FILM_TO_STATUS_VISIBILITY.fetch(@film.visibility, 'public')
      )

      @film.update_columns(status_id: status.id)
      status.update_column(:source_korner, 'cinema') # feed projection discriminator (§3.2)

      @film
    end
  end
end
