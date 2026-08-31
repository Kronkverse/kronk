# frozen_string_literal: true

# REST::Kronk::SearchSerializer — v2/search response shape when the
# meilisearch backend is active. Inherits the accounts / statuses /
# hashtags collections from REST::SearchSerializer and passes the
# five Kronk-native collections (events / proposals / booth sets /
# listings / krews) through as plain arrays.
#
# The Kronk collections are pre-projected in
# `Kronk::Search::PolicyFilter` into a uniform `{id, korner, title,
# subtitle, url}` shape, so no per-type serializer is needed here —
# each element serialises as its native Ruby hash.
#
# Third-party clients that only know the classic Mastodon shape
# ignore the extra keys (JSON parsers drop unknown fields), so the
# extension is backward-compatible on the wire.
class REST::Kronk::SearchSerializer < REST::SearchSerializer
  attribute :events
  attribute :proposals
  attribute :booth_sets
  attribute :listings
  attribute :krews
end
