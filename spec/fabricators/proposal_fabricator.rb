# frozen_string_literal: true

Fabricator(:proposal) do
  created_by_account { Fabricate(:account) }
  title 'A test proposal'
  body  'Proposal body text.'
end
