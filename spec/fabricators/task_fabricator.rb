# frozen_string_literal: true

Fabricator(:task) do
  proposal { Fabricate(:proposal) }
  title 'A test task'
end
