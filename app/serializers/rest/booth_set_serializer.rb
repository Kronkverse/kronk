# frozen_string_literal: true

class REST::BoothSetSerializer < ActiveModel::Serializer
  include RoutingHelper

  # `event_id` retired 2026-08-15 (Phase 5b — FK drop). The Kalendar
  # → Booth link now lives on `korner_attachments`; clients that want
  # the linked event look it up via /api/v1/attachments?target=booth/<id>.
  attributes :id, :title, :description, :artist_name, :event_name, :event_date,
             :genres, :duration_seconds, :audio_url, :cover_url,
             :cover_offset_y, :published, :created_at, :updated_at,
             :tracklist, :tracklist_text, :artists, :kind

  belongs_to :account, serializer: REST::AccountSerializer

  attribute :is_owner, if: :current_user?
  attribute :can_moderate, if: :current_user?
  attribute :saved, if: :current_user?
  # Plays are for the artist (My sets), not a public chart.
  attribute :play_count, if: :sees_plays?

  def id
    object.id.to_s
  end

  def event_date
    object.event_date&.strftime('%Y-%m-%d')
  end

  def audio_url
    object.audio_url
  end

  def cover_url
    object.cover_url
  end

  # Who made it. The uploader first, always, then everyone they credited: a
  # tagged Kronk account (`verified` once that person has confirmed it) or a
  # plain name for someone who is not on Kronk (`account: nil`).
  def artists
    [{ account: brief(object.account), name: nil, verified: true, uploader: true }] +
      object.credits.map do |credit|
        { account: credit.account && brief(credit.account), name: credit.account ? nil : credit.name, verified: credit.verified, uploader: false }
      end
  end

  def tracklist
    Array(object.tracklist)
  end

  # rubocop:disable Naming/PredicatePrefix -- `is_owner` is the JSON API key; renaming would break clients
  def is_owner
    object.account_id == current_user.account.id
  end
  # rubocop:enable Naming/PredicatePrefix

  # Whether the viewer kept this set. The index passes the ids it already
  # looked up (`saved_ids`), so a page of sets is one query, not forty.
  def saved
    ids = instance_options[:saved_ids]
    ids ? ids.include?(object.id) : object.saves.exists?(account_id: current_user.account_id)
  end

  def sees_plays?
    current_user? && (object.account_id == current_user.account_id || can_moderate)
  end

  def can_moderate
    current_user.role&.can?(:manage_reports) || false
  end

  def current_user?
    !current_user.nil?
  end

  private

  def brief(account)
    {
      id: account.id.to_s,
      username: account.username,
      acct: account.acct,
      display_name: account.display_name.presence || account.username,
      avatar: full_asset_url(account.avatar_static_url),
    }
  end
end
