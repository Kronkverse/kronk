# frozen_string_literal: true

Fabricator('Nudges::ConversationMessage', aliases: [:nudges_conversation_message]) do
  conversation   { Fabricate(:nudges_conversation) }
  author_account { |attrs| attrs[:conversation].account_a }
  body           { 'hello' }
end
