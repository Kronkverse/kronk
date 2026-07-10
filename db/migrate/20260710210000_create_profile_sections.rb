# frozen_string_literal: true

# Per-account sectioned profile at /@user, per rebuild spec §Profile.
# A section carries a type ('timeline' | 'korner' | 'kategory'), an
# ordering position, and a small settings blob that varies by type
# (e.g. korner sections carry the target korner_slug).
#
# Every account starts with a single 'timeline' section (position: 0);
# users pick more via profile settings once the frontend lands.
class CreateProfileSections < ActiveRecord::Migration[8.0]
  def change
    create_table :profile_sections do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.string     :section_type, null: false
      t.integer    :position, null: false, default: 0
      t.string     :title
      t.jsonb      :settings, null: false, default: {}
      t.boolean    :visible, null: false, default: true

      t.timestamps
    end

    add_index :profile_sections, [:account_id, :position]
    add_index :profile_sections, [:account_id, :section_type]
  end
end
