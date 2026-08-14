# frozen_string_literal: true

# Kalendar → Albutts (spawn) — the KornerAttachment factory that
# replaces the bespoke `albutts_event_bus.rb` subscriber the primitive
# retired in Phase 3 (docs/kronk_korner_attachments.md §5).
#
# Fired by `Kronk::AttachmentSource#fire_kronk_spawn_attachments` when
# an `Event` is created with `spawn_album` truthy. The factory returns
# the newly-created `Album`; the concern writes the
# `korner_attachments` row that binds them. Idempotent guard on
# `event.spawned_album` mirrors the old subscriber, so a re-fire (e.g.
# double-save) doesn't create a second album.
#
# Legacy FK note: `album.event_id` is set on the new album so consumers
# that still read from the FK column continue to work during the
# transition. A follow-up PR drops the column once every reader has
# migrated to the KornerAttachment join.
Rails.application.config.after_initialize do
  Kronk::AttachmentFactories.register(
    source: 'kalendar',
    target: 'albutts',
    kind: 'spawn'
  ) do |event|
    next event.spawned_album if event.spawned_album.present?

    album = Album.create!(
      owner: event.account,
      title: event.title,
      description: event.description.presence,
      visibility: :public,
      event: event
    )

    Albutts::PublishAlbum.new(album).call

    album
  end
end
