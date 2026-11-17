# frozen_string_literal: true

# A sample (docs/spaces/booth.md, Samples). `can_download` says whether the
# viewer may download it and list it as used; on its own page (`detail`) it
# also carries the viewer's request, if they asked, and the published sets
# that use it.
class REST::BoothSampleSerializer < ActiveModel::Serializer
  attributes :id, :title, :sample_type, :musical_key, :bpm, :genre, :vibes,
             :terms, :duration_seconds, :audio_url, :created_at, :pack,
             :is_owner, :can_download

  belongs_to :account, serializer: REST::AccountSerializer

  attribute :request_state, if: :detail?
  attribute :pending_requests, if: :owner_detail?
  attribute :used_in, if: :detail?

  def id
    object.id.to_s
  end

  def vibes
    Array(object.vibes)
  end

  def pack
    object.pack && { id: object.pack.id.to_s, title: object.pack.title }
  end

  # rubocop:disable Naming/PredicatePrefix -- `is_owner` is the JSON key, as on sets
  def is_owner
    object.account_id == viewer&.id
  end
  # rubocop:enable Naming/PredicatePrefix

  # The index passes the ask-first samples the viewer was given
  # (`granted_ids`), so a page is one query.
  def can_download
    return false if viewer.nil?
    return true if is_owner || !object.ask_first?

    ids = instance_options[:granted_ids]
    ids ? ids.include?(object.id) : object.usable_by?(viewer)
  end

  def request_state
    viewer && object.requests.find_by(account_id: viewer.id)&.state
  end

  def pending_requests
    object.requests.pending.count
  end

  # The published sets that list it under Samples used, newest first.
  def used_in
    object.booth_sets.published.includes(:cover_attachment).order(id: :desc).limit(50).map do |set|
      { id: set.id.to_s, title: set.title, artist_name: set.artist_name, cover_url: set.cover_url }
    end
  end

  def detail?
    instance_options[:detail] == true
  end

  def owner_detail?
    detail? && is_owner
  end

  private

  def viewer
    current_user&.account
  end
end
