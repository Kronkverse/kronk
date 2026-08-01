# frozen_string_literal: true

# One row = the account has seen one item (`content_id`) of one korner
# (`korner_slug`). The per-item half of the standardised korner "seen" plumbing;
# see Kronk::KornerSeen and CreateKornerContentViews.
#
# `content_id` is a `statuses.id` for status-backed korners and a `moments.id`
# for Moments — always interpreted through `korner_slug`, never across korners.
class KornerContentView < ApplicationRecord
  belongs_to :account, inverse_of: :korner_content_views

  validates :korner_slug, presence: true
  validates :content_id, presence: true
  validates :account_id, uniqueness: { scope: [:korner_slug, :content_id] }
end
