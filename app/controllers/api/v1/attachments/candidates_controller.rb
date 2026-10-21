# frozen_string_literal: true

# Candidate-search endpoint for `<AttachmentPicker>` (spec §4.3).
#
#   GET /api/v1/attachments/candidates?korner=<slug>&q=<query>&limit=<n>
#     → [{ slug, id, title, url }, ...]
#
# Resolves `korner` to its primary AR class via `Kronk::KornerRegistry.model_for`,
# ILIKEs the query against whichever of {title, name, display_name} the model
# exposes, keeps what the current account can see (Kronk::KornerRecords),
# caps at 20 (default) / 50 (max). Empty `q` returns the most recent 20 — useful for "just show me
# something" pickers.
#
# Deliberately a shared search endpoint rather than routing to each korner's
# own search: the picker doesn't want to know each korner's URL conventions,
# and every korner's search endpoint has its own auth / scoping quirks. This
# gives one predictable contract for cross-korner UIs. If a korner needs a
# richer picker later (facet filters, sort by attendance, …) it can declare
# a `search_endpoint:` in its manifest and the client falls back to that,
# but nothing yet needs it (spec §4.3 open item).
class Api::V1::Attachments::CandidatesController < Api::BaseController
  DEFAULT_LIMIT = 20
  MAX_LIMIT = 50

  # Column allow-list is closed (title / name / display_name) and the query
  # arrives via Arel's `matches` builder — no string interpolation reaches
  # the SQL, which sidesteps both a real injection risk and Brakeman's
  # weak-confidence flag on `where("#{col} ILIKE ?", ...)`.
  SEARCHABLE_COLUMNS = %w(title name display_name).freeze

  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }
  before_action :require_user!

  def index
    slug = params[:korner].to_s
    klass = Kronk::KornerRegistry.model_for(slug)
    return render(json: { error: "unknown korner '#{slug}'" }, status: 422) unless klass
    # Only korners that take links can be searched: Map's presence or Klot's
    # logs are nobody's to pick.
    return render(json: []) unless accepts_links?(slug)

    scope   = apply_query(klass.all, klass, params[:q].to_s)
    records = Kronk::KornerRecords.findable(klass, scope, current_account, limit: limit)

    render json: records.map { |r| serialize(slug, r) }
  end

  private

  def accepts_links?(slug)
    Array(Kronk::KornerRegistry.find(slug)&.accepts).any? { |entry| entry.is_a?(Hash) && entry['kind'].to_s == KornerAttachment::KIND_LINK }
  end

  def apply_query(scope, klass, query)
    return scope if query.blank?

    column = search_column(klass)
    return scope.none unless column

    escaped = ActiveRecord::Base.sanitize_sql_like(query)
    scope.where(klass.arel_table[column].matches("%#{escaped}%"))
  end

  # Pick the first present title-ish column from the closed allow-list.
  # Kronk's korner records tend to carry one of these three (Event/Album/
  # BoothSet=title, Krew=name, Account=display_name). Returns nil when
  # none exist — the endpoint then 422s the query rather than silently
  # returning nothing.
  def search_column(klass)
    SEARCHABLE_COLUMNS.find { |c| klass.columns_hash.key?(c) }
  end

  def serialize(slug, record)
    {
      slug: slug,
      id: record.id.to_s,
      title: Kronk::KornerRecords.title_of(record),
      url: Kronk::KornerRecords.path_for(slug, record),
    }
  end

  def limit
    n = params[:limit].to_i
    return DEFAULT_LIMIT if n <= 0

    [n, MAX_LIMIT].min
  end
end
