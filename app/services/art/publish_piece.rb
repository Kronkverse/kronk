# frozen_string_literal: true

# Art::PublishPiece — creates the companion Status that renders as the
# `art_card` in the feed. Called from Api::V1::Art::PiecesController#create;
# idempotent so a re-invocation is a no-op if the piece already has a
# status_id.
#
# One card per piece lifetime — later photo additions don't spawn new
# feed cards. Matches the Albutts model (docs/spaces/albutts.md §Feed
# projection).
#
# The Status's `visibility` mirrors the piece's reach tier (public /
# orbit / mates / self_only); the mapping is explicit so a future rename
# on either side is caught by a spec instead of drifting silently.
module Art
  class PublishPiece
    PIECE_TO_STATUS_VISIBILITY = {
      'public' => 'public',
      'mates' => 'mates',
      'orbit' => 'orbit',
      'self_only' => 'self_only',
    }.freeze

    def initialize(piece)
      @piece = piece
    end

    def call
      return @piece if @piece.status_id.present?

      status = PostStatusService.new.call(
        @piece.owner,
        text: @piece.title,
        visibility: PIECE_TO_STATUS_VISIBILITY.fetch(@piece.visibility, 'public')
      )

      @piece.update_columns(status_id: status.id)
      status.update_column(:source_korner, 'art') # feed projection discriminator (§3.2)

      @piece
    end
  end
end
