# frozen_string_literal: true

# Account backups (archive downloads) — Kronk-native surface for the
# old `/settings/export` Rails page (Tal 2026-09-13 audit).
#
#   GET  /api/v1/settings/backups  => [{ id, created_at, ready, dump_url,
#                                        can_create_now, next_available_at }]
#   POST /api/v1/settings/backups  => same shape; 429 if rate-limited.
#
# Backends: `BackupWorker` (existing Sidekiq worker) does the heavy
# lifting; a Backup row is inserted, the worker fills its `dump`
# attachment, and the download URL becomes valid once processing
# finishes. Rate limit lives on `BackupPolicy` (6 days between creates)
# and is echoed in the payload so the SPA can disable the button
# rather than fire-and-catch a 429.
class Api::V1::Settings::BackupsController < Api::BaseController
  include Redisable
  include Lockable
  include Authorization

  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:create]
  before_action :require_user!

  def index
    render json: payload
  end

  def create
    with_redis_lock("backup:#{current_user.id}") do
      authorize :backup, :create?
      @backup = current_user.backups.create!
    end
    BackupWorker.perform_async(@backup.id)
    render json: payload
  rescue Mastodon::NotPermittedError
    render json: rate_limited_error, status: 429
  end

  private

  def payload
    {
      backups: current_user.backups.order(created_at: :desc).map { |b| serialize_backup(b) },
      can_create_now: can_create_now?,
      next_available_at: next_available_at,
    }
  end

  def serialize_backup(backup)
    ready = backup.processed?
    {
      id: backup.id.to_s,
      created_at: backup.created_at.iso8601,
      ready: ready,
      dump_url: ready ? backup.dump.url : nil,
    }
  end

  # Mirror of BackupPolicy: no create within MIN_AGE of the most-recent
  # backup. Exposed to the client so the button state matches what a
  # POST would allow.
  def can_create_now?
    last = current_user.backups.order(created_at: :desc).first
    return true if last.nil?

    last.created_at < BackupPolicy::MIN_AGE.ago
  end

  def next_available_at
    last = current_user.backups.order(created_at: :desc).first
    return nil if last.nil?

    (last.created_at + BackupPolicy::MIN_AGE).iso8601
  end

  def rate_limited_error
    {
      error: 'rate_limited',
      next_available_at: next_available_at,
    }
  end
end
