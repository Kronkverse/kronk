# frozen_string_literal: true

# Kronikles — a single long-form written work by one author. The body
# is stored as raw markdown (no length limit); rendering happens
# client-side. Kind labels the work as poetry / short story / essay /
# letter / journal / other — a display badge, not a schema constraint,
# so re-labeling is a plain update. Krew scoping isn't offered in v1;
# the four reach tiers are the whole visibility axis.
class Chronicle < ApplicationRecord
  include Reachable

  belongs_to :owner, class_name: 'Account'
  belongs_to :status, optional: true, inverse_of: :chronicle
  has_many :chronicle_pictures, dependent: :destroy
  has_many :pictures, through: :chronicle_pictures, source: :media_attachment

  # A picture in the body: `![caption](picture:<media id>)`, on a line of
  # its own. The id is one of the owner's own uploaded images.
  PICTURE = /!\[[^\]\n]*\]\(picture:(\d+)\)/
  MAX_PICTURES = 30

  after_save :sync_pictures!, if: :saved_change_to_body?

  # Kind labels — displayed as a badge on the reader and the feed card,
  # filterable in the directory once the picker earns a place. `other`
  # is the escape hatch for anything the six named kinds don't cover.
  enum :kind,
       { essay: 0, short_story: 1, poetry: 2, letter: 3, journal: 4, other: 5 },
       suffix: :kind

  # Reach ladder. Krew is not offered on Kronikles in v1 — long-form
  # authorship doesn't share the group-coordination shape that made krew
  # scoping useful on Albutts.
  enum :visibility,
       { public: 0, mates: 1, orbit: 3, self_only: 4 },
       suffix: :scope

  validates :title, presence: true, length: { maximum: 240 }
  # No length cap on the body — user said "no character limit". Presence
  # is required so an empty submit is rejected at the model layer, not
  # just the composer.
  validates :body, presence: true

  scope :recent, -> { order(created_at: :desc) }

  # Reachable adapter — reach visibility (visible_to / visible_to?)
  # lives in the concern; these tell it how a Chronicle stores its
  # owner and (that it has no) krew scoping.
  def self.reachable_owner_column
    :owner_id
  end

  def self.reachable_krew_scope(_krew_ids)
    none
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

  private

  # Reachable adapter (instance side).
  def reachable_owner_id
    owner_id
  end

  def reachable_owner
    owner
  end

  def reachable_krew_member?(_viewer)
    false
  end
end
