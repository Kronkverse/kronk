# frozen_string_literal: true

# Kronk::AttachmentSource — the model-side half of the KornerAttachment
# primitive (docs/kronk_korner_attachments.md §2.4). Include this into
# a korner's primary AR class and declare the korner slug it represents:
#
#   class Event < ApplicationRecord
#     include Kronk::AttachmentSource
#     self.attachment_source_slug = 'kalendar'
#   end
#
# Behaviour:
#   * On create, iterate the manifest's `attaches:` entries. For each
#     `spawn`-kind entry with a `trigger: field:<name>` where the
#     source record's `<name>` is truthy, look up the factory in
#     `Kronk::AttachmentFactories`, invoke it with the source record,
#     and write the `korner_attachments` row that binds the two.
#   * On destroy, cascade-delete every `spawn` attachment's target
#     record (spawn semantics: the target exists BECAUSE of the source).
#     `link` and `reference` attachments only remove the join row; the
#     target survives.
#
# `event:<bus-event>` triggers are handled by a separate mechanism
# (framework subscribes to the named `Kronk::KornerEvents` event and
# invokes the factory) — landing in a follow-up PR when the second
# adopter needs it. Field triggers cover the current Kalendar → Albutts
# pair, which is the only one migrating in Phase 3.

module Kronk
  module AttachmentSource
    extend ActiveSupport::Concern

    included do
      class_attribute :attachment_source_slug, instance_accessor: false

      after_create_commit :fire_kronk_spawn_attachments
      after_destroy :cleanup_kronk_attachments
    end

    private

    def fire_kronk_spawn_attachments
      slug = self.class.attachment_source_slug
      return if slug.blank?

      manifest = Kronk::KornerRegistry.find(slug)
      return unless manifest

      Array(manifest.attaches).each do |entry|
        next unless entry.is_a?(Hash) && entry['kind'] == 'spawn'
        next unless field_trigger_active?(entry['trigger'])

        target = invoke_spawn_factory(slug, entry['to'], entry)
        next unless target

        create_spawn_attachment_row!(slug, entry['to'], target)
      end
    end

    def field_trigger_active?(trigger)
      return false unless trigger.is_a?(String) && trigger.start_with?('field:')

      field = trigger.sub('field:', '')
      respond_to?(field) && public_send(field)
    end

    def invoke_spawn_factory(source_slug, target_slug, entry)
      factory = Kronk::AttachmentFactories.lookup(source_slug, target_slug, 'spawn')
      unless factory
        Rails.logger.warn("[kronk:attachments] no factory registered for #{source_slug} -> #{target_slug} (spawn); declared in manifest #{entry.inspect}")
        return nil
      end

      factory.call(self)
    rescue => e
      Rails.logger.error("[kronk:attachments] spawn factory #{source_slug} -> #{target_slug} raised: #{e.class} #{e.message}")
      nil
    end

    def create_spawn_attachment_row!(source_slug, target_slug, target)
      KornerAttachment.create!(
        source_slug: source_slug,
        source_id: id,
        target_slug: target_slug,
        target_id: target.id,
        kind: KornerAttachment::KIND_SPAWN,
        created_by_account: attachment_source_actor
      )
    rescue ActiveRecord::RecordInvalid => e
      # A duplicate row (unique index on the endpoint quintuple) means the
      # trigger fired more than once for the same pair — safe to ignore.
      # Any other invalid message is worth surfacing.
      raise unless e.record.errors.of_kind?(:source_id, :taken)
    end

    # Best-effort account resolution for `created_by_account`. Most korner
    # primary records expose either `account` (Event / BoothSet / Moment)
    # or `owner` (Album). Falls back to nil which the KornerAttachment
    # validation catches — a hard failure at that point is better than a
    # silent misattribution.
    def attachment_source_actor
      return account if respond_to?(:account) && account.present?
      return owner if respond_to?(:owner) && owner.present?

      nil
    end

    def cleanup_kronk_attachments
      slug = self.class.attachment_source_slug
      return if slug.blank?

      attachments = KornerAttachment.from_source(slug, id)
      attachments.where(kind: KornerAttachment::KIND_SPAWN).find_each do |a|
        a.target_record&.destroy
        a.destroy
      end
      attachments.where.not(kind: KornerAttachment::KIND_SPAWN).destroy_all
    end
  end
end
