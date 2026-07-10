# frozen_string_literal: true

require_relative 'base'

module Mastodon
  module CLI
    class Kategories < Base
      desc 'seed', 'Seed curated Kategories from config/kategory_defaults.yaml'
      long_desc <<~LONG # rubocop:disable I18n/RailsI18n/DecorateString
        Reads config/kategory_defaults.yaml and marks the corresponding Tag rows
        as `curated: true` (creating any that don't yet exist). Idempotent —
        safe to run repeatedly.
      LONG
      def seed
        Rails.application.eager_load!
        counts = ::Kronk::Kategories.seed!
        say "#{counts[:created]} created · #{counts[:curated]} re-marked curated · #{::Tag.curated.count} curated total"
      end
    end
  end
end
