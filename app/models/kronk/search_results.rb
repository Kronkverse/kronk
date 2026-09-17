# frozen_string_literal: true

# Kronk::SearchResults — extended search presenter.
#
# Upstream `::Search` carries the three Mastodon-native collections
# (accounts / statuses / hashtags). Kronk::SearchResults inherits
# those and adds the Kronk-native ones (events / proposals / booth
# sets / listings / krews) that Meilisearch indexes but the vanilla
# `Search` model doesn't know about.
#
# Each Kronk collection is a plain array of hashes (`{id, korner,
# title, subtitle, url}`) — projection lives in
# `Kronk::Search::PolicyFilter` alongside the visibility gates, so
# no per-type REST serializer is needed. `REST::Kronk::SearchSerializer`
# renders the accounts/statuses/hashtags via their existing
# serializers and passes the Kronk arrays through as-is.
#
# Only surfaced when `SEARCH_BACKEND=meilisearch`; the upstream
# `SearchService` fallback path keeps returning plain `::Search`.
module Kronk
  class SearchResults < ::Search
    attributes :events, :proposals, :booth_sets, :listings, :krews

    def initialize(attrs = {})
      # `::Search` (ActiveModelSerializers::Model) coerces missing
      # attributes to nil — set the empty-array defaults ourselves so
      # a caller that only sets accounts/statuses/hashtags gets
      # sane [] for the Kronk collections.
      super
      self.events     ||= []
      self.proposals  ||= []
      self.booth_sets ||= []
      self.listings   ||= []
      self.krews      ||= []
    end
  end
end
