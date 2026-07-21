# frozen_string_literal: true

Fabricator('Nudges::Relationship', aliases: [:nudges_relationship]) do
  transient :one, :two

  account_a { |attrs| resolve_relationship_pair(attrs).first }
  account_b { |attrs| resolve_relationship_pair(attrs).last }
end

def resolve_relationship_pair(attrs)
  one = attrs[:one] || Fabricate(:account)
  two = attrs[:two] || Fabricate(:account)
  [one, two].sort_by(&:id)
end
