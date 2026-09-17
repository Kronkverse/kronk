# frozen_string_literal: true

# Kategories reuse Mastodon's hashtag infrastructure. A `curated:` flag
# marks the ~20 default kategories Kronk ships (`music`, `essays`,
# `politics`, etc.) — see config/kategory_defaults.yaml.
#
# Uncurated tags remain regular hashtags. Feed filters and profile
# section suggestions read the curated set; user-created tags are still
# free to become popular and, over time, get curated by governance.
class AddCuratedToTags < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    add_column :tags, :curated, :boolean, default: false, null: false, if_not_exists: true
    add_index :tags, :curated,
              where: 'curated = true',
              algorithm: :concurrently,
              if_not_exists: true
  end

  def down
    remove_index :tags, :curated, algorithm: :concurrently, if_exists: true
    remove_column :tags, :curated, if_exists: true
  end
end
