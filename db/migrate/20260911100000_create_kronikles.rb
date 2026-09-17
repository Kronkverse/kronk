# frozen_string_literal: true

# Kronikles — single-author korner for long-form writing (essays,
# short stories, journals, letters, poetry). One table:
#
#   chronicles — title / body (markdown, no length limit) / kind
#                (poetry / short_story / essay / letter / journal /
#                other) / owner / visibility / optional feed-projection
#                Status link.
#
# The body is stored as raw markdown; the reader renders it client-side
# via a small in-file transformer. No separate media rows in v1 — a
# Kronikle is text-only. Attached artwork lives on an Art piece and can
# link back via the shared korner attachments system if the author
# chooses.
#
# Invariants encoded in the schema:
#   * A chronicle's `status_id` (feed projection) is a partial unique
#     index — one companion Status per chronicle, but most rows have
#     none until PublishChronicle fires.
class CreateKronikles < ActiveRecord::Migration[8.0]
  def change
    create_table :chronicles do |t|
      t.string  :title, null: false, limit: 240
      t.text    :body, null: false, default: ''
      # 0 essay / 1 short_story / 2 poetry / 3 letter / 4 journal /
      # 5 other. Matches Chronicle#kind enum verbatim. `essay` is the
      # default because "an essay" is the most neutral bucket for a
      # piece of writing that isn't obviously one of the others.
      t.integer :kind, null: false, default: 0
      t.references :owner,
                   null: false,
                   foreign_key: { to_table: :accounts, on_delete: :cascade },
                   index: true
      t.integer :visibility, null: false, default: 0
      t.references :status,
                   null: true,
                   foreign_key: { on_delete: :nullify },
                   index: { unique: true, where: 'status_id IS NOT NULL', name: 'index_chronicles_on_status_id_unique' }
      t.timestamps
    end
    add_index :chronicles, :visibility
    add_index :chronicles, :kind
  end
end
