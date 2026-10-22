# frozen_string_literal: true

class CreateLinkRedirects < ActiveRecord::Migration[8.0]
  def change
    create_table :link_redirects do |t|
      t.string :record_type, null: false
      t.bigint :record_id, null: false
      t.string :slug, null: false
      t.timestamps
    end

    add_index :link_redirects, [:record_type, :slug], unique: true
    add_index :link_redirects, [:record_type, :record_id]
  end
end
