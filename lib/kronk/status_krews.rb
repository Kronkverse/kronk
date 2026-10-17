# frozen_string_literal: true

module Kronk
  # Keeps a korner item's posts in step with its Krews. A Krew is an
  # additive audience on a post (`statuses_krews`), set when the post is
  # made. An album or event linked to a Krew later
  # (docs/spaces/krew.md, Linking) has to add the Krew to the posts it
  # already has too, or Krew members would see the album but not its
  # photos' posts, and an event would never reach the Krew.
  module StatusKrews
    module_function

    def add(status_ids, krew_ids)
      status_ids = Array(status_ids).compact.map(&:to_i)
      krew_ids = Array(krew_ids).compact.map(&:to_i)
      return if status_ids.empty? || krew_ids.empty?

      ActiveRecord::Base.connection.execute(ActiveRecord::Base.sanitize_sql_array([<<~SQL.squish, status_ids, krew_ids]))
        INSERT INTO statuses_krews (status_id, krew_id)
        SELECT s, k FROM unnest(ARRAY[?]::bigint[]) AS s CROSS JOIN unnest(ARRAY[?]::bigint[]) AS k
        ON CONFLICT (status_id, krew_id) DO NOTHING
      SQL
    end

    def remove(status_ids, krew_ids)
      status_ids = Array(status_ids).compact.map(&:to_i)
      krew_ids = Array(krew_ids).compact.map(&:to_i)
      return if status_ids.empty? || krew_ids.empty?

      ActiveRecord::Base.connection.execute(ActiveRecord::Base.sanitize_sql_array([
                                                                                    'DELETE FROM statuses_krews WHERE status_id IN (?) AND krew_id IN (?)', status_ids, krew_ids
                                                                                  ]))
    end
  end
end
