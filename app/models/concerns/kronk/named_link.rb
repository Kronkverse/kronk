# frozen_string_literal: true

# Kronk::NamedLink — a record's page is reached by its name, not a counting
# number: /hub/albutts/albums/beach-day, beach-day-2 for the next one with
# that title (decisions.md, 2026-10-22). Counting numbers told anyone how
# many albums existed and let them walk the list.
#
#   class Album < ApplicationRecord
#     include Kronk::NamedLink
#     self.named_link_reserved = %w(new)  # optional
#   end
#
# The slug follows the title: a rename takes a new one and the old one is
# kept in `link_redirects`, so links already shared still open the page. An
# old slug is never handed to another record. `by_link!` takes a slug,
# an old slug or the numeric id (bookmarks from before the change).
module Kronk::NamedLink
  extend ActiveSupport::Concern

  SLUG_MAX = 200

  included do
    class_attribute :named_link_reserved, default: [].freeze

    has_many :link_redirects, as: :record, dependent: :delete_all

    validates :slug, presence: true, uniqueness: true, length: { maximum: SLUG_MAX }

    before_validation :assign_slug, if: :slug_stale?
    after_save :keep_old_slug, if: -> { saved_change_to_slug? && slug_before_last_save.present? }
  end

  class_methods do
    def by_link!(identifier)
      identifier = identifier.to_s
      return find(identifier) if identifier.match?(/\A\d+\z/)

      find_by(slug: identifier) ||
        LinkRedirect.find_by!(record_type: polymorphic_name, slug: identifier).record
    end

    def slug_taken?(candidate, except_id)
      where.not(id: except_id).exists?(slug: candidate) ||
        LinkRedirect.where(record_type: polymorphic_name, slug: candidate).where.not(record_id: except_id).exists?
    end
  end

  private

  def slug_stale?
    slug.blank? || will_save_change_to_title?
  end

  def assign_slug
    base = title.to_s.parameterize.slice(0, SLUG_MAX - 6).delete_suffix('-')
    base = model_name.element.dasherize if base.blank?
    return if slug.present? && (slug == base || slug.match?(/\A#{Regexp.escape(base)}-\d+\z/))

    candidate = base
    # A bare number would be read as an id, and a reserved word is a page.
    candidate = "#{base}-1" if base.match?(/\A\d+\z/) || named_link_reserved.include?(base)

    n = 1
    while self.class.slug_taken?(candidate, id)
      n += 1
      candidate = "#{base}-#{n}"
    end

    self.slug = candidate
  end

  def keep_old_slug
    link_redirects.where(slug: slug).delete_all
    link_redirects.create!(slug: slug_before_last_save)
  end
end
