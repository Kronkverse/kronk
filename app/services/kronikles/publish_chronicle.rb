# frozen_string_literal: true

# Kronikles::PublishChronicle — creates the companion Status that
# renders as the `kronikles_card` in the feed. Called from
# Api::V1::Kronikles::ChroniclesController#create; idempotent so a
# re-invocation is a no-op if the chronicle already has a status_id.
#
# One card per chronicle lifetime — later body edits don't spawn new
# feed cards. Same pattern as Art::PublishPiece / Albutts::PublishAlbum.
#
# The Status's `visibility` mirrors the chronicle's reach tier
# (public / orbit / mates / self_only); the mapping is explicit so a
# future rename on either side is caught by a spec instead of drifting
# silently.
module Kronikles
  class PublishChronicle
    CHRONICLE_TO_STATUS_VISIBILITY = {
      'public' => 'public',
      'mates' => 'mates',
      'orbit' => 'orbit',
      'self_only' => 'self_only',
    }.freeze

    def initialize(chronicle)
      @chronicle = chronicle
    end

    def call
      return @chronicle if @chronicle.status_id.present?

      status = PostStatusService.new.call(
        @chronicle.owner,
        text: @chronicle.title,
        visibility: CHRONICLE_TO_STATUS_VISIBILITY.fetch(@chronicle.visibility, 'public')
      )

      @chronicle.update_columns(status_id: status.id)
      status.update_column(:source_korner, 'kronikles') # feed projection discriminator (§3.2)

      @chronicle
    end
  end
end
