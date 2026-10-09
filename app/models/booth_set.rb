# frozen_string_literal: true

class BoothSet < ApplicationRecord
  include Searchable

  searchable_as :booth_sets

  def as_json_for_search
    {
      id: id,
      title: title.to_s,
      artist_name: artist_name.to_s,
      # The column is `genres`, an array — there has never been a `genre`.
      # Asking for one raised NameError inside the indexer, which swallowed it
      # as a warning, so every Booth set silently failed to index and a DJ set
      # could not be searched for at all (found 2026-09-14, reindexing a copy
      # of production).
      genres: Array(genres).map(&:to_s),
      event_name: event_name.to_s,
      description: description.to_s,
      account_id: account_id,
      published: published?,
      play_count: play_count.to_i,
      created_at: created_at&.to_i,
    }
  end

  belongs_to :account
  # `belongs_to :event` retired 2026-08-15 alongside the
  # `booth_sets.event_id` FK drop (Phase 5b). The Kalendar → Booth
  # link now lives on `korner_attachments` — look up the source event
  # via `KornerAttachment.to_target('booth', id).where(kind: 'link').first&.source_record`.
  belongs_to :audio_attachment, class_name: 'MediaAttachment', optional: true
  belongs_to :cover_attachment, class_name: 'MediaAttachment', optional: true
  belongs_to :status, class_name: 'Status', optional: true, inverse_of: :booth_set

  # Transitional dual-write. `shared_status_id` is the pre-2.0.0 column;
  # `status_id` is the canonical §5.5 column. Both stay populated during
  # the transition; old column drops in 2.1.
  def shared_status_id=(value)
    super
    self[:status_id] = value if has_attribute?(:status_id)
  end

  def status_id=(value)
    super
    self[:shared_status_id] = value if has_attribute?(:shared_status_id)
  end

  # Deprecated readers — new code uses `#status(_id)`. Logs once per
  # process on first read so stray call-sites surface in staging logs
  # before the shared_status_id column drops in 2.1.0.
  def shared_status
    BoothSet.warn_deprecated_status_read!
    status
  end

  def shared_status_id
    BoothSet.warn_deprecated_status_read!
    read_attribute(:shared_status_id) || self[:status_id]
  end

  def self.warn_deprecated_status_read!
    return if @deprecated_status_read_warned

    @deprecated_status_read_warned = true
    Rails.logger.warn('[BoothSet] deprecated read of shared_status(_id); prefer #status(_id). Column drops in 2.1.0.')
  end

  validates :title, presence: true, length: { maximum: 200 }
  validates :artist_name, presence: true, length: { maximum: 200 }
  validates :description, length: { maximum: 5000 }
  validates :event_name, length: { maximum: 200 }
  validates :genres, length: { maximum: 10 }
  validate :tracklist_must_be_well_formed

  # Track list (docs/spaces/booth.md, "Track list"): ordered entries of
  # `{ "start_seconds" => Integer|nil, "artist" => String|nil, "title" => String }`.
  # Written through `tracklist_text=`, one track per line, so the forms stay
  # a single textarea: "12:34 Artist - Title", "1:02:03 Artist – Title",
  # "[4:00] Title" or just "Title".
  TRACKLIST_MAX = 200
  TRACK_FIELD_MAX = 200
  TRACK_START_MAX = 24 * 60 * 60

  TRACK_LINE = /\A\s*(?:[\[(]?(?<time>(?:\d{1,2}:)?\d{1,2}:\d{2})[\])]?\s*(?:[-–—.)]\s*)?)?(?<rest>.*?)\s*\z/
  TRACK_SEPARATOR = /\s+[-–—]\s+/

  def tracklist_text=(text)
    self.tracklist = text.to_s.lines.filter_map { |line| self.class.parse_track_line(line) }
  end

  def tracklist_text
    Array(tracklist).map do |entry|
      start = entry['start_seconds'] ? "#{self.class.format_track_time(entry['start_seconds'])} " : ''
      name = [entry['artist'].presence, entry['title']].compact.join(' - ')
      "#{start}#{name}"
    end.join("\n")
  end

  def self.parse_track_line(line)
    match = TRACK_LINE.match(line.to_s.strip)
    return if match.nil? || match[:rest].blank?

    artist, title = match[:rest].split(TRACK_SEPARATOR, 2)
    artist, title = nil, artist if title.blank?
    {
      'start_seconds' => match[:time] && match[:time].split(':').map(&:to_i).reduce(0) { |sum, part| (sum * 60) + part },
      'artist' => artist&.strip.presence,
      'title' => title.strip,
    }
  end

  def self.format_track_time(seconds)
    hours, rest = seconds.to_i.divmod(3600)
    minutes, secs = rest.divmod(60)
    hours.positive? ? format('%<h>d:%<m>02d:%<s>02d', h: hours, m: minutes, s: secs) : format('%<m>d:%<s>02d', m: minutes, s: secs)
  end

  scope :published, -> { where(published: true) }
  scope :recent, -> { order(created_at: :desc) }

  def audio_url
    audio_attachment&.file&.url(:original)
  end

  def cover_url
    cover_attachment&.file&.url(:small)
  end

  def increment_play_count!
    increment!(:play_count)
  end

  private

  def tracklist_must_be_well_formed
    entries = tracklist
    return errors.add(:tracklist, :invalid) unless entries.is_a?(Array)
    return errors.add(:tracklist, :too_long, count: TRACKLIST_MAX) if entries.size > TRACKLIST_MAX

    entries.each do |entry|
      next errors.add(:tracklist, :invalid) unless entry.is_a?(Hash) && entry['title'].is_a?(String) && entry['title'].present?
      next errors.add(:tracklist, :too_long, count: TRACK_FIELD_MAX) if entry['title'].size > TRACK_FIELD_MAX || entry['artist'].to_s.size > TRACK_FIELD_MAX

      start = entry['start_seconds']
      errors.add(:tracklist, :invalid) unless start.nil? || (start.is_a?(Integer) && start.between?(0, TRACK_START_MAX))
    end
  end
end
