# frozen_string_literal: true

Fabricator('Nudges::Conversation', aliases: [:nudges_conversation]) do
  transient :one, :two

  kind             { 'mate' }
  account_a        { |attrs| resolve_pair(attrs).first }
  account_b        { |attrs| resolve_pair(attrs).last }
  last_activity_at { Time.current }
end

# Sort the pair when both are supplied via transients; otherwise pick two fresh accounts.
def resolve_pair(attrs)
  one = attrs[:one] || Fabricate(:account)
  two = attrs[:two] || Fabricate(:account)
  [one, two].sort_by(&:id)
end
