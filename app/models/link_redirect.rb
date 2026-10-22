# frozen_string_literal: true

# A name a record's page used to have, kept after a rename so old links
# still open it. See Kronk::NamedLink.
class LinkRedirect < ApplicationRecord
  belongs_to :record, polymorphic: true
end
