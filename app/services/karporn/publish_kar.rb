# frozen_string_literal: true

# Karporn::PublishKar — creates the companion Status that renders as
# the `karporn_card` in the feed. Called from
# Api::V1::Karporn::KarsController#create; idempotent so a re-invocation
# is a no-op if the kar already has a status_id.
#
# One card per kar lifetime. Same pattern as Art::PublishPiece /
# Cinema::PublishFilm.
module Karporn
  class PublishKar
    KAR_TO_STATUS_VISIBILITY = {
      'public' => 'public',
      'mates' => 'mates',
      'orbit' => 'orbit',
      'self_only' => 'self_only',
    }.freeze

    def initialize(kar)
      @kar = kar
    end

    def call
      return @kar if @kar.status_id.present?

      status = PostStatusService.new.call(
        @kar.owner,
        text: @kar.title,
        visibility: KAR_TO_STATUS_VISIBILITY.fetch(@kar.visibility, 'public')
      )

      @kar.update_columns(status_id: status.id)
      status.update_column(:source_korner, 'karporn') # feed projection discriminator (§3.2)

      @kar
    end
  end
end
