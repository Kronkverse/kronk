# frozen_string_literal: true

Fabricator(:rose) do
  from_account { Fabricate(:account) }
  to_account   { Fabricate(:account) }
  sent_on      { Rose.current_day }
end
