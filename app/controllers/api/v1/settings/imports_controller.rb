# frozen_string_literal: true

# CSV bulk imports — Kronk-native surface for the old
# `/settings/imports` Rails page (Tal 2026-09-13 audit).
#
#   GET    /api/v1/settings/imports         => { imports: [ImportJSON, ...] }
#   POST   /api/v1/settings/imports         multipart body:
#                                             { type, mode, data }
#                                           => { import: ImportJSON } (state=unconfirmed)
#   POST   /api/v1/settings/imports/:id/confirm
#                                           => { import: ImportJSON } (state=scheduled)
#   DELETE /api/v1/settings/imports/:id     — only allowed on unconfirmed
#                                             imports; deletes the pending row + its BulkImportRows
#
# Wraps the existing `Form::Import` (CSV parsing + row insert) and
# `BulkImportWorker` (the actual applying job). The 3-step SPA flow
# (upload → preview → confirm) mirrors the Rails 3-page flow but as
# API calls: client uploads → gets `total_items` + `likely_mismatched`
# back → user confirms → client POSTs `:id/confirm` → worker runs →
# client polls GET /imports for status.
class Api::V1::Settings::ImportsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:create, :confirm, :destroy]
  before_action :require_user!
  before_action :set_bulk_import, only: [:show, :confirm, :destroy]

  RECENT_IMPORTS_LIMIT = 10

  def index
    imports = current_account.bulk_imports.order(created_at: :desc).limit(RECENT_IMPORTS_LIMIT)
    render json: { imports: imports.map { |i| serialize_import(i) } }
  end

  def show
    render json: { import: serialize_import(@bulk_import) }
  end

  def create
    form = Form::Import.new(
      current_account: current_account,
      type: params[:type],
      overwrite: ActiveModel::Type::Boolean.new.cast(params[:mode].to_s == 'overwrite'),
      data: params[:data]
    )

    if form.save
      render json: { import: serialize_import(form.bulk_import) }
    else
      render json: { error: 'invalid_import', details: form.errors.as_json }, status: 422
    end
  end

  def confirm
    unless @bulk_import.state_unconfirmed?
      render json: { error: 'already_confirmed' }, status: 422
      return
    end

    @bulk_import.update!(state: :scheduled)
    BulkImportWorker.perform_async(@bulk_import.id)
    render json: { import: serialize_import(@bulk_import) }
  end

  def destroy
    unless @bulk_import.state_unconfirmed?
      render json: { error: 'already_confirmed' }, status: 422
      return
    end

    @bulk_import.destroy!
    render_empty
  end

  private

  def set_bulk_import
    @bulk_import = current_account.bulk_imports.find(params[:id])
  end

  def serialize_import(bulk_import)
    {
      id: bulk_import.id.to_s,
      type: bulk_import.type,
      state: bulk_import.state,
      mode: bulk_import.overwrite ? 'overwrite' : 'merge',
      total_items: bulk_import.total_items,
      processed_items: bulk_import.processed_items,
      imported_items: bulk_import.imported_items,
      original_filename: bulk_import.original_filename,
      likely_mismatched: bulk_import.likely_mismatched,
      created_at: bulk_import.created_at.iso8601,
      finished_at: bulk_import.finished_at&.iso8601,
    }
  end
end
