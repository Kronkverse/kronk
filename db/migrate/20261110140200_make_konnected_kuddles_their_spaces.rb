# frozen_string_literal: true

# A Kuddle Konnected to a Krew or a projekt becomes that space's own
# (Tal, 2026-11-10: "konnecting a kuddle would create a kuddle space
# specifically tied to that space"), members only from now on. The first
# one Konnected to each space, if it has several; the rest stay open
# Kuddles. The Konnect rows stay, unread, so nothing is lost.
class MakeKonnectedKuddlesTheirSpaces < ActiveRecord::Migration[8.1]
  SPACES = { 'krew' => 'krew_id', 'freethedream' => 'freethedream_project_id' }.freeze

  def up
    SPACES.each do |slug, column|
      links(slug).each do |room_id, space_id|
        next if select_value("SELECT 1 FROM huddle_sessions WHERE #{column} = #{space_id.to_i}")

        execute(<<~SQL.squish)
          UPDATE huddle_sessions SET scope = 'space', #{column} = #{space_id.to_i}
          WHERE id = #{room_id.to_i} AND scope = 'room' AND retired_at IS NULL
            AND krew_id IS NULL AND freethedream_project_id IS NULL
        SQL
      end
    end
  end

  def down; end

  private

  # [room id, space id] for each link, oldest first.
  def links(slug)
    select_rows(<<~SQL.squish)
      SELECT source_id, target_id FROM korner_attachments
      WHERE kind = 'link' AND source_slug = 'huddle' AND target_slug = '#{slug}'
      UNION ALL
      SELECT target_id, source_id FROM korner_attachments
      WHERE kind = 'link' AND source_slug = '#{slug}' AND target_slug = 'huddle'
      ORDER BY 1
    SQL
  end
end
