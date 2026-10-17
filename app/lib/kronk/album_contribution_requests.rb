# frozen_string_literal: true

# The nudges around asking to add photos to an album. Published on the
# korner event bus; config/korners/nudges.yaml routes both as directed,
# since the person asking and the album's owner need not be Mates.
module Kronk
  module AlbumContributionRequests
    module_function

    def notify_requested(album, asker)
      Kronk::KornerEvents.publish(
        'albutts.contribution.requested',
        actor_account_id: asker.id,
        recipient_account_id: album.owner_id,
        album_id: album.id
      )
    end

    def notify_granted(album, asker)
      Kronk::KornerEvents.publish(
        'albutts.contribution.granted',
        actor_account_id: album.owner_id,
        recipient_account_id: asker.id,
        album_id: album.id
      )
    end
  end
end
