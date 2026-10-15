# frozen_string_literal: true

class Vacuum::MediaAttachmentsVacuum
  TTL = 1.day.freeze

  # Korners keep uploads that never join a post: a Moment's photo, a kar's
  # photos, a film's video, a message's picture. Upstream calls those
  # "unattached" and deletes them after TTL, so every column that holds an
  # upload id is listed here and protects what it points at. A spec checks
  # this list against the schema, so a new column can't be missed.
  KEEPERS = {
    'album_photos' => %w(media_attachment_id),
    'albums' => %w(cover_media_attachment_id),
    'art_piece_photos' => %w(media_attachment_id),
    'art_pieces' => %w(cover_media_attachment_id),
    'booth_sets' => %w(audio_attachment_id cover_attachment_id),
    'chronicle_pictures' => %w(media_attachment_id),
    'drafts' => %w(media_attachment_ids),
    'events' => %w(image_id),
    'films' => %w(video_media_attachment_id),
    'freethedream_projects' => %w(cover_media_attachment_id),
    'kar_photos' => %w(media_attachment_id),
    'kars' => %w(cover_media_attachment_id),
    'listing_photos' => %w(media_attachment_id),
    'listing_shops' => %w(media_attachment_id),
    'moments' => %w(media_attachment_id voice_media_attachment_id),
    'nudge_messages' => %w(media_attachment_id voice_attachment_id),
    'nudges_conversation_messages' => %w(media_attachment_id media_attachment_ids voice_attachment_id),
  }.freeze

  # Array columns hold several ids; the rest hold one.
  ARRAY_KEEPERS = %w(drafts.media_attachment_ids nudges_conversation_messages.media_attachment_ids).freeze

  KEPT_BY_KORNERS = KEEPERS.flat_map do |table, columns|
    columns.map do |column|
      match = ARRAY_KEEPERS.include?("#{table}.#{column}") ? "media_attachments.id = ANY(#{table}.#{column})" : "#{table}.#{column} = media_attachments.id"
      "NOT EXISTS (SELECT 1 FROM #{table} WHERE #{match})"
    end
  end.join(' AND ').freeze

  def initialize(retention_period)
    @retention_period = retention_period
  end

  def perform
    vacuum_orphaned_records!
    vacuum_cached_files! if retention_period?
  end

  private

  def vacuum_cached_files!
    media_attachments_past_retention_period.find_in_batches do |media_attachments|
      AttachmentBatch.new(MediaAttachment, media_attachments).clear
    rescue => e
      Rails.logger.error("Skipping batch while removing cached media attachments due to error: #{e}")
    end
  end

  def vacuum_orphaned_records!
    orphaned_media_attachments.find_in_batches do |media_attachments|
      AttachmentBatch.new(MediaAttachment, media_attachments).delete
    rescue => e
      Rails.logger.error("Skipping batch while removing orphaned media attachments due to error: #{e}")
    end
  end

  def media_attachments_past_retention_period
    MediaAttachment
      .remote
      .cached
      .created_before(@retention_period.ago)
      .updated_before(@retention_period.ago)
  end

  def orphaned_media_attachments
    MediaAttachment
      .unattached
      .where(KEPT_BY_KORNERS)
      .created_before(TTL.ago)
  end

  def retention_period?
    @retention_period.present?
  end
end
