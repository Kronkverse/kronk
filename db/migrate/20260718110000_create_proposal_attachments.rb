# frozen_string_literal: true

# Files attached to a Kommons proposal: mockups, briefs and references that
# say what someone wants built.
#
# The audience is deliberately not end users browsing Kommons — it is the
# people and agents who implement the proposal. Someone imagines a korner,
# mocks it up, attaches it here, and whoever builds it reads it from the
# proposal rather than from a link in a chat.
#
# Storage follows spec §5: spaces/<korner>/<resource>/<id>/. Files are
# stored private and served through an authenticated endpoint, never as
# public objects — attachments may be HTML, and public HTML on the media
# domain is an XSS surface.
class CreateProposalAttachments < ActiveRecord::Migration[8.0]
  def change
    create_table :proposal_attachments do |t|
      t.bigint  :proposal_id, null: false
      t.bigint  :account_id,  null: false
      t.integer :kind,        null: false, default: 0
      t.text    :description

      t.string   :file_file_name
      t.string   :file_content_type
      t.bigint   :file_file_size
      t.datetime :file_updated_at

      t.timestamps null: false
    end

    add_index :proposal_attachments, :proposal_id
    add_index :proposal_attachments, :account_id
    add_foreign_key :proposal_attachments, :proposals, on_delete: :cascade, validate: false
    add_foreign_key :proposal_attachments, :accounts, on_delete: :cascade, validate: false
  end
end
