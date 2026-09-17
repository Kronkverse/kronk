# frozen_string_literal: true

# Kalendar → Albutts (spawn) — the KornerAttachment factory that
# replaces the bespoke `albutts_event_bus.rb` subscriber retired in
# Phase 3 (docs/kronk_korner_attachments.md §5).
#
# Fired by `Kronk::AttachmentSource#fire_kronk_spawn_attachments` when
# an `Event` is created with `spawn_album` truthy. Returns the newly-
# created `Album`; the concern then writes the `korner_attachments`
# row that binds them. Idempotent via the KornerAttachment lookup so
# a re-fire (e.g. double-save) surfaces the existing album rather
# than creating a second one.

# lib/ isn't autoloaded by default in Rails 8, so this initializer has
# to explicitly `require` the registry it registers into. Rails runs
# the initializer body eagerly at boot, ahead of any autoload chance
# for `Kronk::AttachmentFactories` — the deploy blew up on the
# resulting NameError before this line landed (2026-08-14 shadow
# deploy trace, blocking every subsequent PR from reaching shadow —
# PR #1511).
require 'kronk/attachment_factories'

Rails.application.config.after_initialize do
  Kronk::AttachmentFactories.register(
    source: 'kalendar',
    target: 'albutts',
    kind: 'spawn'
  ) do |event|
    existing = KornerAttachment.from_source('kalendar', event.id)
                               .where(target_slug: 'albutts', kind: 'spawn')
                               .first
    next existing.target_record if existing

    album = Album.create!(
      owner: event.account,
      title: event.title,
      description: event.description.presence,
      visibility: :public
    )

    Albutts::PublishAlbum.new(album).call

    album
  end
end
