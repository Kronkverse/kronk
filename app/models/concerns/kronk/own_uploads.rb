# frozen_string_literal: true

# Korner records point at uploads by id, and the id comes from the client.
# Only the owner's own uploads may be used: another member's upload id would
# otherwise put their photo (and its URL) on your record.
#
#   owns_uploads :cover_media_attachment, owner: :owner_id
module Kronk::OwnUploads
  extend ActiveSupport::Concern

  class_methods do
    def owns_uploads(*associations, owner:)
      validate do
        owner_id = public_send(owner)
        associations.each do |name|
          next unless will_save_change_to_attribute?(self.class.reflect_on_association(name).foreign_key)

          upload = public_send(name)
          errors.add(name, :invalid) if upload.present? && upload.account_id != owner_id
        end
      end
    end
  end
end
