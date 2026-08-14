# frozen_string_literal: true

# KornerAttachment — one row per cross-korner connection.
#
# The generic primitive that replaces per-pair FK columns (album.event_id,
# booth_set.event_id) + bespoke subscribers (albutts_event_bus.rb). Each row
# names two records by manifest slug + id, plus a kind:
#
#   spawn      — auto-created by a source-side trigger; cascade-delete on
#                source destroy (source record's `Kronk::AttachmentSource`
#                concern handles the cleanup — added in Phase 2).
#   link       — user-added; independent lifecycle. Source deletion just
#                removes the join row; the target survives.
#   reference  — passive mention (e.g. a nudge referencing an event);
#                always independent.
#
# Validation gates BOTH:
#   * Consent — source manifest's `attaches:` MUST name (target_slug, kind),
#     AND target manifest's `accepts:` MUST name (source_slug, kind), each
#     side honouring `'*'` wildcards. Mirrors the emits/listens contract.
#   * Records exist — Kronk::KornerRegistry.model_for resolves each slug
#     to its primary AR class; the id must find a live row.
#
# Referential integrity is application-level (no FKs on source_id/target_id
# because the target table varies by slug). No `dependent: :destroy` on the
# record models themselves for this table — a source model that wants
# cascade behaviour includes the `Kronk::AttachmentSource` concern (Phase 2).
#
# Spec: docs/kronk_korner_attachments.md §2.
class KornerAttachment < ApplicationRecord
  KIND_SPAWN     = 'spawn'
  KIND_LINK      = 'link'
  KIND_REFERENCE = 'reference'
  KINDS = [KIND_SPAWN, KIND_LINK, KIND_REFERENCE].freeze

  belongs_to :created_by_account, class_name: 'Account'

  validates :source_slug, :target_slug, presence: true
  validates :source_id, :target_id, presence: true
  validates :kind, inclusion: { in: KINDS }
  validates :source_id, uniqueness: { scope: %i(source_slug target_slug target_id kind) }
  validate  :manifests_agree
  validate  :records_exist

  scope :from_source, ->(slug, id) { where(source_slug: slug, source_id: id) }
  scope :to_target,   ->(slug, id) { where(target_slug: slug, target_id: id) }

  def source_record
    resolve_record(source_slug, source_id)
  end

  def target_record
    resolve_record(target_slug, target_id)
  end

  private

  def resolve_record(slug, id)
    klass = Kronk::KornerRegistry.model_for(slug)
    return nil unless klass

    klass.find_by(id: id)
  end

  # Source manifest's `attaches:` MUST list (target_slug, kind) AND target
  # manifest's `accepts:` MUST list (source_slug, kind). '*' wildcards on
  # either side satisfy the check. The message is the same on both misses
  # so a client sees one error either way — the granularity that matters
  # (source vs target) is already implied by the fact that the request
  # names both.
  def manifests_agree
    return if source_slug.blank? || target_slug.blank? || kind.blank?

    unless manifest_permits?(source_slug, :attaches, 'to', target_slug) &&
           manifest_permits?(target_slug, :accepts, 'from', source_slug)
      errors.add(:base, "manifests do not permit a #{kind} attachment from #{source_slug} to #{target_slug}")
    end
  end

  def manifest_permits?(slug, field, direction_key, other_slug)
    manifest = Kronk::KornerRegistry.find(slug)
    return false unless manifest

    entries = Array(manifest.public_send(field))
    entries.any? do |entry|
      next false unless entry.is_a?(Hash)
      next false unless entry['kind'].to_s == kind

      other = entry[direction_key].to_s
      other == '*' || other == other_slug
    end
  end

  def records_exist
    return if source_slug.blank? || target_slug.blank?

    errors.add(:source_id, 'references a missing record') if source_record.nil?
    errors.add(:target_id, 'references a missing record') if target_record.nil?
  end
end
