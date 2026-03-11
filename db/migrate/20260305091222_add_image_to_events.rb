# frozen_string_literal: true

class AddImageToEvents < ActiveRecord::Migration[7.2]
  disable_ddl_transaction!

  def change
    safety_assured do
      add_reference :events, :image, null: true, foreign_key: { to_table: :media_attachments, on_delete: :nullify }
    end
  end
end
