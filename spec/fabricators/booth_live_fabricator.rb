# frozen_string_literal: true

Fabricator(:booth_live) do
  account   { Fabricate.build(:account) }
  title     'Live from the Pier'
  starts_at { 1.hour.from_now }
end
