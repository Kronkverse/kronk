# frozen_string_literal: true

# The Kronk-written profile Kuestions (`config/kuestions_profile_seeds.yml`),
# the starting set people answer and pin to their profile. They replace the
# old profile Fields one for one, keyed the same way.
#
# `sync!` writes them into `questions`: it matches on seed_key, creates any
# that are missing and updates title and format, in file order. It never
# deletes, because a seeded Kuestion may already have answers.
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

    def sync!
      entries.each do |entry|
        question = Question.find_or_initialize_by(seed_key: entry['key'])
        question.assign_attributes(
          kind: 'profile',
          title: entry['title'],
          answer_format: entry['format'],
          locked: false
        )
        question.save! if question.changed?
      end
    end
  end
end
