# frozen_string_literal: true

# A comment in the short thread every project, part and item carries.
module Freethedream
  class Comment < ApplicationRecord
    self.table_name = 'freethedream_comments'

    BODY_MAX = 2000

    # @username, for someone in the emergence: they're told (a Nudge).
    MENTION = /(?<![\w@])@([a-z0-9_]+)/i

    belongs_to :subject, polymorphic: true
    belongs_to :account
    belongs_to :parent, class_name: 'Freethedream::Comment', optional: true
    belongs_to :resolved_by, class_name: 'Account', optional: true
    # A thing on the list this comment is about (Tal, 2026-10-18).
    belongs_to :quoted_item, class_name: 'Freethedream::Item', optional: true
    has_many :replies, class_name: 'Freethedream::Comment', foreign_key: :parent_id, inverse_of: :parent, dependent: :destroy

    validates :body, presence: true, length: { maximum: BODY_MAX }, on: :create
    validate :reply_on_same_subject, on: :create
    validate :quotes_from_the_same_emergence, on: :create

    scope :oldest_first, -> { order(:created_at, :id) }
    scope :threads, -> { where(parent_id: nil) }

    def resolved?
      resolved_at.present?
    end

    def removed?
      body.blank?
    end

    # The emergence the talk is in.
    def emergence
      subject.is_a?(Freethedream::Project) ? subject.top : subject.root
    end

    # The usernames written as @username in the body.
    def mentioned_usernames
      body.to_s.scan(MENTION).flatten.map(&:downcase).uniq
    end

    # Who's tagged: local accounts in the emergence, named as @username.
    def mentioned_accounts(names = mentioned_usernames)
      return Account.none if names.empty?

      members = Freethedream::Membership.member.where(project_id: emergence.id).select(:account_id)
      Account.local.where(id: members).where(Account.arel_table[:username].lower.in(names))
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

    def quotes_from_the_same_emergence
      return if quoted_item.nil?

      errors.add(:quoted_item_id, :invalid) unless quoted_item.root_id == emergence.id
    end
  end
end
