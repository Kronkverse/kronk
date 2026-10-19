# frozen_string_literal: true

# Talk about one thing on the list (Tal, 2026-10-18): a comment can quote a
# Thing Bringing item, shown as a card on the comment. Taking the item off
# the list leaves the comment, without its card.
class AddQuotedItemToFreethedreamComments < ActiveRecord::Migration[8.0]
  def change
    # Both tables are small (FreeTheDream went live on 2026-10-13).
    safety_assured do
      add_reference :freethedream_comments, :quoted_item, foreign_key: { to_table: :freethedream_items, on_delete: :nullify }
    end
  end
end
