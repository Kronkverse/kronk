# frozen_string_literal: true

# Where to get an app for a phone (an app store, or the file itself), for
# the Get the app button on its Kollection page (docs/spaces/kollection.md).
class AddDownloadURLToKollectionApps < ActiveRecord::Migration[8.1]
  def change
    add_column :kollection_apps, :download_url, :string
  end
end
