# frozen_string_literal: true

# The Kronk-written profile Kuestions (`config/kuestions_profile_seeds.yml`),
# the starting set people answer and pin to their profile. They replaced the
# old profile Fields one for one, keyed the same way; since 2026-10-15 only
# three are offered and the rest are `retired` (kept for the answers they
# already have).
#
# `sync!` writes them into `questions`: it matches on seed_key, creates any
# that are missing and updates title, format and asker, in file order. A
# member's profile Kuestion with the same wording is adopted rather than
# doubled. It never deletes, because a seeded Kuestion may have answers.
module Kuestions
  module ProfileSeeds
    module_function

    CONFIG_PATH = Rails.root.join('config', 'kuestions_profile_seeds.yml').freeze

    def entries
      @entries ||= YAML.load_file(CONFIG_PATH).map { |entry| entry.transform_keys(&:to_s).freeze }.freeze
    end

    def entry_for(key)
      return if key.blank?

      @by_key ||= entries.index_by { |entry| entry['key'] }
      @by_key[key.to_s]
    end

    # Position of a seed in the file, for ordering the Profile view.
    def position_of(key)
      @positions ||= entries.each_with_index.to_h { |entry, index| [entry['key'], index] }
      @positions.fetch(key.to_s, entries.size)
    end

    # A retired seed is no longer offered to anyone who hasn't answered it.
    def retired?(key)
      entry_for(key)&.fetch('retired', false) == true
    end

    def sync!
      entries.each do |entry|
        question = Question.find_by(seed_key: entry['key']) || adoptable(entry) || Question.new(seed_key: entry['key'])
        question.assign_attributes(
          seed_key: entry['key'],
          kind: 'profile',
          title: entry['title'],
          answer_format: entry['format'],
          locked: false
        )
        author = entry['author'].presence && Account.find_local(entry['author'])
        question.created_by_account = author if author
        question.save! if question.changed?
      end
    end

    # Someone may already have asked it in these words.
    def adoptable(entry)
      Question.profile.where(seed_key: nil).where('lower(title) = ?', entry['title'].downcase).order(:id).first
    end
  end
end
