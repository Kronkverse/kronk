# frozen_string_literal: true

# A projekt (a FreeTheDream emergence) lives in one Krew and is Konnected to
# it, which is how the Krew page shows it (docs/spaces/freethedream.md, "The
# Krew"). That link can't be taken off; a projekt Konnected to some other
# Krew is a link like any other.
module Kronk
  module ProjektLinks
    module_function

    def linked(_attachment, _actor); end

    def unlinked(_attachment); end

    def removable?(attachment)
      project_id, = AttachmentEffects.ends(attachment, 'freethedream')
      krew_id, = AttachmentEffects.ends(attachment, 'krew')
      !Freethedream::Project.exists?(id: project_id, parent_id: nil, krew_id: krew_id)
    end
  end
end
