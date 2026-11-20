# frozen_string_literal: true

# Kronk — Mateship. A row means `account` doesn't see `korner_slug` posts
# from `target_account` in their feeds; `posts` stands for their plain posts
# (the ones no korner projects). Set on the Mateship page, applied by
# Kronk::MateTuneOutGate (decisions.md, 2026-11-20).
class MateTuneOut < ApplicationRecord
  PLAIN_POSTS = 'posts'

  belongs_to :account
  belongs_to :target_account, class_name: 'Account'

  validates :korner_slug, presence: true
  validates :korner_slug, uniqueness: { scope: [:account_id, :target_account_id] }
end
