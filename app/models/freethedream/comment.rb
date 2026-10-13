# frozen_string_literal: true

# A comment in the short thread every project, part and item carries.
module Freethedream
  class Comment < ApplicationRecord
    self.table_name = 'freethedream_comments'

    BODY_MAX = 2000

    belongs_to :subject, polymorphic: true
    belongs_to :account
    belongs_to :parent, class_name: 'Freethedream::Comment', optional: true
    belongs_to :resolved_by, class_name: 'Account', optional: true
    has_many :replies, class_name: 'Freethedream::Comment', foreign_key: :parent_id, inverse_of: :parent, dependent: :destroy

    validates :body, presence: true, length: { maximum: BODY_MAX }, on: :create
    validate :reply_on_same_subject, on: :create

    scope :oldest_first, -> { order(:created_at, :id) }
    scope :threads, -> { where(parent_id: nil) }

    def resolved?
      resolved_at.present?
    end

    def removed?
      body.blank?
    end

    # Taking back a comment someone has replied to keeps the thread: the
    # words go, the replies stay.
    def remove!
      replies.exists? ? update_columns(body: '') : destroy!
    end

    private

    def reply_on_same_subject
      return if parent.nil?

      errors.add(:parent_id, :invalid) unless parent.subject_type == subject_type && parent.subject_id == subject_id
    end
  end
end
