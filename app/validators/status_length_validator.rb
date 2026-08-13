# frozen_string_literal: true

class StatusLengthValidator < ActiveModel::Validator
  # Kronk runs a much longer post than upstream Mastodon's 500: long-form
  # writing is a thing people come here to do. Raised 5000 → 15000 on
  # 2026-08-13 because 5000 was cutting real posts off mid-piece.
  #
  # Clients read this through `/api/v1/instance` and `/api/v2/instance`
  # (`configuration.statuses.max_characters`), so the web composer's counter
  # follows automatically. Anything that hardcodes its own cap does not —
  # see the note in the PR that raised this.
  MAX_CHARS = 15_000
  URL_PLACEHOLDER_CHARS = 23
  URL_PLACEHOLDER = 'x' * 23

  def validate(status)
    return unless status.local? && !status.reblog?

    status.errors.add(:text, I18n.t('statuses.over_character_limit', max: MAX_CHARS)) if too_long?(status)
  end

  private

  def too_long?(status)
    countable_length(combined_text(status)) > MAX_CHARS
  end

  def countable_length(str)
    str.each_grapheme_cluster.size
  end

  def combined_text(status)
    [status.spoiler_text, countable_text(status.text)].join
  end

  def countable_text(str)
    return '' if str.blank?

    # To ensure that we only give length concessions to entities that
    # will be correctly parsed during formatting, we go through full
    # entity extraction

    entities = Extractor.remove_overlapping_entities(Extractor.extract_urls_with_indices(str, extract_url_without_protocol: false) + Extractor.extract_mentions_or_lists_with_indices(str))

    rewrite_entities(str, entities) do |entity|
      if entity[:url]
        URL_PLACEHOLDER
      elsif entity[:screen_name]
        "@#{entity[:screen_name].split('@').first}"
      end
    end
  end

  def rewrite_entities(str, entities)
    entities.sort_by! { |entity| entity[:indices].first }
    result = +''

    last_index = entities.reduce(0) do |index, entity|
      result << str[index...entity[:indices].first]
      result << yield(entity)
      entity[:indices].last
    end

    result << str[last_index..]
    result
  end
end
