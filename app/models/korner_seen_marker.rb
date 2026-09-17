# frozen_string_literal: true

# Per-(account, korner) baseline bounding the seen-set in KornerContentView.
# Everything with `content_id <= baseline_id` is treated as seen. Advanced when
# the account opens the korner; see Kronk::KornerSeen and CreateKornerSeenMarkers.
class KornerSeenMarker < ApplicationRecord
  belongs_to :account, inverse_of: :korner_seen_markers

  validates :korner_slug, presence: true
  validates :account_id, uniqueness: { scope: :korner_slug }
end
