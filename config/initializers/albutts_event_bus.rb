# frozen_string_literal: true

# Albutts subscribers.
#
# Currently:
#   * `kalendar.event.created` — if the event was created with
#     `spawn_album: true`, spin up a companion Albutt linked to it
#     (docs/spaces/albutts.md §Cross-korner connections: Kalendar →
#     Albutts). Owner = event creator; visibility public for now;
#     RSVP-derived contribution rights are a later refinement.
Rails.application.config.after_initialize do
  Kronk::KornerEvents.subscribe('kalendar.event.created') do |payload|
    event = Event.find_by(id: payload[:event_id])
    next unless event && payload[:spawn_album]
    next if event.spawned_album.present?

    album = Album.create!(
      owner: event.account,
      title: event.title,
      description: event.description.presence,
      visibility: :public,
      event: event
    )

    # Fire the album's own feed projection.
    Albutts::PublishAlbum.new(album).call
  rescue => e
    Rails.logger.error("[albutts] failed to spawn album for event #{payload[:event_id]}: #{e.class} #{e.message}")
  end
end
