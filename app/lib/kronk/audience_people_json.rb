# frozen_string_literal: true

# The people a record is for, or kept from (Kronk::PeopleAudience), as its
# owner's edit form reads them back: `added` and `removed`, each the
# account fields the reach picker's People panel draws. Only the owner is
# told; to anyone else it is nil, since who was kept out is theirs alone.
module Kronk
  module AudiencePeopleJson
    module_function

    def for(record, viewer)
      return nil if viewer.nil? || viewer.id != record.reachable_owner_id

      people = record.record_people.includes(:account).to_a
      {
        added: people.reject(&:excluded).map { |person| account_json(person.account) },
        removed: people.select(&:excluded).map { |person| account_json(person.account) },
      }
    end

    def account_json(account)
      {
        id: account.id.to_s,
        acct: account.acct,
        display_name: account.display_name.presence || account.username,
        avatar: account.avatar_static_url,
      }
    end
  end
end
