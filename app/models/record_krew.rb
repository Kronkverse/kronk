# frozen_string_literal: true

# A Krew in a record's audience, for the korners without a Krew column of
# their own (Kronk::KrewAudience): `korner_slug` + `record_id` name the
# record as a Konnection does. One row per (record, Krew).
#
# Like AlbumKrew, each row keeps a Konnection to its Krew beside it
# (Kronk::RecordKrewLinks), and tells what follows the record's audience
# that it changed (Kronk::Audience), unless the record itself is going.
class RecordKrew < ApplicationRecord
  belongs_to :krew

  validates :korner_slug, :record_id, presence: true
  validates :krew_id, uniqueness: { scope: %i(korner_slug record_id) }

  after_create  { Kronk::RecordKrewLinks.audience_added(self) }
  after_destroy { Kronk::RecordKrewLinks.audience_removed(self) }
  after_create  :record_audience_changed
  after_destroy :record_audience_changed, unless: :destroyed_by_association

  def record
    Kronk::KornerRegistry.model_for(korner_slug)&.find_by(id: record_id)
  end

  private

  def record_audience_changed
    found = record
    Kronk::Audience.changed(found) if found
  end
end
