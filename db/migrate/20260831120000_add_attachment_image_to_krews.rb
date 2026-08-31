# frozen_string_literal: true

class AddAttachmentImageToKrews < ActiveRecord::Migration[8.0]
  def change
    add_column :krews, :image_file_name, :string
    add_column :krews, :image_content_type, :string
    add_column :krews, :image_file_size, :integer
    add_column :krews, :image_updated_at, :datetime
  end
end
