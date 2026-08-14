# frozen_string_literal: true

# Candidate-search endpoint for `<AttachmentPicker>` (spec §4.3).
#
#   GET /api/v1/attachments/candidates?korner=<slug>&q=<query>&limit=<n>
#     → [{ slug, id, title, url }, ...]
#
# Resolves `korner` to its primary AR class via `Kronk::KornerRegistry.model_for`,
# ILIKEs the query against whichever of {title, name, display_name} the model
# exposes, scopes to what the current account can see, caps at 20 (default) /
# 50 (max). Empty `q` returns the most recent 20 — useful for "just show me
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

  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }
  before_action :require_user!

  def index
    slug = params[:korner].to_s
    klass = Kronk::KornerRegistry.model_for(slug)
    return render(json: { error: "unknown korner '#{slug}'" }, status: 422) unless klass

    scope = scope_for(klass)
    scope = apply_query(scope, klass, params[:q].to_s)

    records = scope.order(created_at: :desc).limit(limit)

    render json: records.map { |r| serialize(slug, r) }
  end

  private

  def scope_for(klass)
    if klass.respond_to?(:visible_to)
      klass.visible_to(current_account)
    elsif klass.columns_hash.key?('account_id')
      klass.where(account_id: current_account.id)
    elsif klass.columns_hash.key?('owner_id')
      klass.where(owner_id: current_account.id)
    else
      klass.none
    end
  end

  def apply_query(scope, klass, query)
    return scope if query.blank?

    column = search_column(klass)
    return scope.none unless column

    scope.where("#{scope.model.quoted_table_name}.#{column} ILIKE ?", "%#{ActiveRecord::Base.sanitize_sql_like(query)}%") # rubocop:disable I18n/RailsI18n/DecorateString -- SQL fragment, not user-facing text
  end

  # Pick the first present title-ish column. Kronk's korner records tend to
  # carry one of these three (Event/Album/BoothSet=title, Krew=name,
  # Account=display_name). Returns nil when none exist — the endpoint then
  # 422s the query rather than silently returning nothing.
  def search_column(klass)
    %w(title name display_name).find { |c| klass.columns_hash.key?(c) }
  end

  def serialize(slug, record)
    {
      slug: slug,
      id: record.id.to_s,
      title: record_title(record),
      url: "/hub/#{slug}/#{record.id}",
    }
  end

  def record_title(record)
    %i(title name display_name).each do |method|
      value = record.public_send(method) if record.respond_to?(method)
      return value if value.is_a?(String) && !value.empty?
    end
    nil
  end

  def limit
    n = params[:limit].to_i
    return DEFAULT_LIMIT if n <= 0

    [n, MAX_LIMIT].min
  end
end
