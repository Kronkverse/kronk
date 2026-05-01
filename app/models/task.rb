# frozen_string_literal: true

class Task < ApplicationRecord
  belongs_to :proposal
  belongs_to :assigned_to_account, class_name: 'Account', optional: true

  enum :status, { open: 0, in_progress: 1, done: 2 }

  validates :title, presence: true

  scope :open_tasks, -> { where(status: :open) }
end
