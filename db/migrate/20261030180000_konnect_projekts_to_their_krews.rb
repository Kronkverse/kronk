# frozen_string_literal: true

# Projekts live in Krews and the Krew page shows them through their Konnect
# link (docs/spaces/freethedream.md, "The Krew"). Every emergence already
# has its Krew; this links the two. Safe to re-run: a pair already linked is
# left alone.
class KonnectProjektsToTheirKrews < ActiveRecord::Migration[8.0]
  def up
    Freethedream::Project.reset_column_information
    Freethedream::Project.top_level.where.not(krew_id: nil).includes(:krew).find_each do |project|
      creator = project.owner_id || project.krew&.seeded_by_account_id
      next if creator.nil? || Kronk::AttachmentEffects.between('freethedream', project.id, 'krew', project.krew_id).exists?

      KornerAttachment.create!(source_slug: 'freethedream', source_id: project.id, target_slug: 'krew', target_id: project.krew_id,
                               kind: KornerAttachment::KIND_LINK, created_by_account_id: creator)
    end
  end

  def down
    # The links are ordinary Konnections by now; leave them.
  end
end
