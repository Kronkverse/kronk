# frozen_string_literal: true

# Kronikles — a single long-form written work by one author. The body
# is stored as raw markdown (no length limit); rendering happens
# client-side. Kind labels the work as poetry / short story / essay /
# letter / journal / other — a display badge, not a schema constraint,
# so re-labeling is a plain update. Its audience is the reach ladder
# plus any Krews it is for (`record_krews`, Kronk::KrewAudience).
class Chronicle < ApplicationRecord
  include Reachable
  include Kronk::AttachmentSource
  include Kronk::AudienceBearer
  include Kronk::KrewAudience

  self.attachment_source_slug = 'kronikles'

  belongs_to :owner, class_name: 'Account'
  belongs_to :status, optional: true, inverse_of: :chronicle
  has_many :chronicle_pictures, dependent: :destroy
  has_many :pictures, through: :chronicle_pictures, source: :media_attachment
  # A chapter of one of its owner's Series, or none (ChronicleSeries).
  belongs_to :series, class_name: 'ChronicleSeries', optional: true, inverse_of: :chapters

  # A picture in the body: `![caption](picture:<media id>)`, on a line of
  # its own. The id is one of the owner's own uploaded images.
  PICTURE = /!\[[^\]\n]*\]\(picture:(\d+)\)/
  MAX_PICTURES = 30

  before_save :place_in_series, if: :will_save_change_to_series_id?
  after_save :sync_pictures!, if: :saved_change_to_body?

  # Kind labels — displayed as a badge on the reader and the feed card,
  # filterable in the directory once the picker earns a place. `other`
  # is the escape hatch for anything the six named kinds don't cover.
  enum :kind,
       { essay: 0, short_story: 1, poetry: 2, letter: 3, journal: 4, other: 5 },
       suffix: :kind

  # Reach ladder. Krews are an additive axis on top (Kronk::KrewAudience,
  # 2026-10-25: every korner with an audience can be for a Krew).
  enum :visibility,
       { public: 0, mates: 1, orbit: 3, self_only: 4 },
       suffix: :scope

  validates :title, presence: true, length: { maximum: 240 }
  # No length cap on the body — user said "no character limit". Presence
  # is required so an empty submit is rejected at the model layer, not
  # just the composer.
  validates :body, presence: true
  validate :series_is_owners, if: :will_save_change_to_series_id?

  scope :recent, -> { order(created_at: :desc) }

  # Reachable adapter — reach visibility (visible_to / visible_to?)
  # lives in the concern; these tell it how a Chronicle stores its
  # owner and its Krews.
  def self.reachable_owner_column
    :owner_id
  end

  def self.reachable_krew_scope(krew_ids)
    audience_krew_scope(krew_ids)
  end

  # Short preview for the feed card / directory — first ~240 chars of
  # the plain-text body (strips leading markdown syntax so the excerpt
  # doesn't lead with '# ' or '- '). One-shot at read time, no cache.
  def excerpt(length: 240)
    plain = body.to_s.gsub(PICTURE, ' ').gsub(/^\s*[#>*-]+\s*/, '').gsub(/\s+/, ' ').strip
    return plain if plain.length <= length

    "#{plain[0, length].rstrip}…"
  end

  # Make the pictures on record match the ones the body names: the owner's
  # own images only, at most MAX_PICTURES. A picture the body no longer
  # names is let go, and the orphaned-media sweep takes it from there.
  def sync_pictures!
    wanted = body.to_s.scan(PICTURE).flatten.map(&:to_i).uniq.first(MAX_PICTURES)
    owned  = owner.media_attachments.where(id: wanted, type: :image).pluck(:id)

    chronicle_pictures.where.not(media_attachment_id: owned).destroy_all
    (owned - chronicle_pictures.pluck(:media_attachment_id)).each do |media_id|
      chronicle_pictures.create!(media_attachment_id: media_id)
    end
  end

  # Where this Kronikle sits among the chapters of its Series that `viewer`
  # can see: its number, how many there are, and the ones either side.
  # Nil when it is in no Series. A chapter the viewer can't see is never
  # counted or pointed to.
  def chapter_for(viewer)
    return if series.nil?

    ids = series.chapters_visible_to(viewer).pluck(:id)
    at  = ids.index(id)
    return if at.nil?

    {
      number: at + 1,
      count: ids.size,
      previous_id: at.positive? ? ids[at - 1].to_s : nil,
      next_id: ids[at + 1]&.to_s,
    }
  end

  private

  # Only into one of the owner's own Series.
  def series_is_owners
    errors.add(:series, :invalid) if series.present? && series.owner_id != owner_id
  end

  # A Kronikle joining a Series goes last; leaving one, it has no place.
  def place_in_series
    self.series_position = if series_id.nil?
                             nil
                           else
                             (Chronicle.where(series_id: series_id).where.not(id: id).maximum(:series_position) || 0) + 1
                           end
  end

  # Reachable adapter (instance side).
  def reachable_owner_id
    owner_id
  end

  def reachable_owner
    owner
  end

  def reachable_krew_member?(viewer)
    audience_krew_member?(viewer)
  end
end
