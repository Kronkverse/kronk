# frozen_string_literal: true

Fabricator(:booth_set) do
  account     { Fabricate.build(:account) }
  title       'Test set'
  artist_name 'Test artist'
end
