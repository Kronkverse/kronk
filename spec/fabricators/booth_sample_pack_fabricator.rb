# frozen_string_literal: true

Fabricator(:booth_sample_pack) do
  account { Fabricate.build(:account) }
  title   'Test pack'
end
