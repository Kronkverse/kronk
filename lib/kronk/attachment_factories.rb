# frozen_string_literal: true

# Kronk::AttachmentFactories — tiny registry mapping
# `(source_slug, target_slug, kind)` to a block that materialises the
# target record from the source record.
#
# The `spawn` half of the KornerAttachment primitive
# (docs/kronk_korner_attachments.md §3.2). When a source record fires a
# `spawn` trigger declared in its manifest — `field:<name>` on create,
# or `event:<bus-event>` — `Kronk::AttachmentSource` (the model-side
# concern) resolves the matching factory here and invokes it. The
# factory returns the newly-created target record; the concern writes
# the `korner_attachments` row that binds them.
#
# Factories are registered at boot in per-korner initializers under
# `config/initializers/attachment_factories/*.rb`. Register once, at
# load time — the registry is not thread-safe under mutation.
#
# Example:
#
#   Kronk::AttachmentFactories.register(
#     source: 'kalendar',
#     target: 'albutts',
#     kind:   'spawn'
#   ) do |event|
#     Album.create!(
#       owner:       event.account,
#       title:       event.title,
#       description: event.description.presence,
#       visibility:  :public,
#       event:       event # backwards-compat FK mirror; drops in a
#                          # later PR after readers migrate
#     )
#   end

module Kronk
  module AttachmentFactories
    @registry = {}

    class << self
      def register(source:, target:, kind:, &block)
        raise ArgumentError, 'factory block required' unless block

        @registry[key(source, target, kind)] = block
      end

      # Look up a registered factory. Returns the block or nil.
      def lookup(source, target, kind)
        @registry[key(source, target, kind)]
      end

      # Test / boot-cycle reset. Callers that register at load-time do
      # not need this; specs that stub in a factory can `reset!` in a
      # `before(:each)` if isolation matters.
      def reset!
        @registry = {}
      end

      def registered
        @registry.keys.map { |k| { source: k[0], target: k[1], kind: k[2] } }
      end

      private

      def key(source, target, kind)
        [source.to_s, target.to_s, kind.to_s].freeze
      end
    end
  end
end
