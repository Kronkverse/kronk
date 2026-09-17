# frozen_string_literal: true

Fabricator('Nudges::Event', aliases: [:nudges_event]) do
  conversation       { Fabricate(:nudges_conversation) }
  actor_account      { |attrs| attrs[:conversation].account_b }
  source_korner_slug { 'kommons' }
  verb               { 'frothed' }
  interaction        { 'passive' }
end
