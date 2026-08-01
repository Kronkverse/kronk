# frozen_string_literal: true

Fabricator(:profile_section) do
  account
  section_type 'timeline'
  position 0
end
