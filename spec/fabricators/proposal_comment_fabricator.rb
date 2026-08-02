# frozen_string_literal: true

Fabricator(:proposal_comment) do
  proposal
  account { Fabricate(:account) }
  body 'A test comment.'
end
