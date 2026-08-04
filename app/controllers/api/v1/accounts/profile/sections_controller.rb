# frozen_string_literal: true

# Read-only listing of another account's visible drawn shelves.
# Powers the shelved /@:acct profile — a viewer fetches the target
# account's shelves here (not their own).
#
#   GET /api/v1/accounts/:account_id/profile/sections
#   GET /api/v1/accounts/:account_id/profile/sections/:id/statuses
#
# The owner-authored ("told") side of the profile lives on
# `ProfileCard`; this controller is drawn shelves only.
#
# Per-shelf visibility uses the same five-scope ladder as
# `ProfileCard` — a shelf hidden from the viewer never appears in
# the index, its statuses endpoint returns nothing. Per-status
# visibility is enforced on top via the canonical
# `StatusFilter → StatusPolicy` chain.
class Api::V1::Accounts::Profile::SectionsController < Api::BaseController
  before_action -> { authorize_if_got_token! :read, :'read:accounts', :'read:statuses' }
  before_action :set_account

  skip_before_action :require_authenticated_user!

  DEFAULT_LIMIT = 20

  def index
    render json: sections_scope, each_serializer: REST::ProfileSectionSerializer
  end

  def statuses
    section = @account.profile_sections.find(params[:id])
    return render(json: []) unless section.visible_to?(current_user&.account)

    scope = statuses_scope_for(section)

    # A `chosen`-order shelf returns a hand-picked Array in the owner's
    # order; skip cursor pagination + limit (the whole curated set is
    # the answer). Everything else is an AR scope.
    if scope.is_a?(ActiveRecord::Relation)
      scope = scope.where(Status.arel_table[:id].lt(params[:max_id])) if params[:max_id].present?
      scope = scope.where(Status.arel_table[:id].gt(params[:min_id])) if params[:min_id].present?
      scope = scope.limit(limit_param(DEFAULT_LIMIT))
      ids   = scope.pluck(:id)
    else
      ids = scope.map(&:id)
    end

    # Route through the same visibility gate every other statuses
    # endpoint uses (Api::V1::StatusesController#index, thread lookups,
    # etc). Without this, a `direct` / `private` / krew-scoped status
    # bound to this shelf renders to any viewer — the shelf's per-post
    # visibility is enforced only here.
    @statuses = Status.permitted_statuses_from_ids(ids, current_user&.account, stable: true)

    render json: @statuses,
           each_serializer: REST::StatusSerializer,
           relationships: StatusRelationshipsPresenter.new(@statuses, current_user&.account_id)
  end

  private

  def set_account
    @account = Account.find(params[:account_id])
  end

  # Only shelves visible to the viewer per the five-scope ladder —
  # Ruby-side filter after fetch is fine at profile-page scale
  # (dozens of rows). Kept alongside the `visible` boolean the owner
  # toggles.
  def sections_scope
    @account.profile_sections.shown.ordered.select { |s| s.visible_to?(current_user&.account) }
  end

  # Drawn-shelf dispatch. All queries build off `account.statuses` so
  # a shelf can never leak content the account didn't post.
  def statuses_scope_for(section)
    order_mode = section.settings&.dig('order') || 'newest'
    return chosen_statuses(section) if order_mode == 'chosen'

    base = drawn_base_scope(section)
    order_mode == 'oldest' ? base.reorder(id: :asc) : base.reorder(id: :desc)
  end

  # The owner has hand-picked ids in `order_ids`. Preserve that order;
  # ignore any id that no longer resolves (deleted post, etc.).
  def chosen_statuses(section)
    ids = Array(section.settings&.dig('order_ids'))
    return [] if ids.empty?

    found = @account.statuses.where(id: ids).index_by { |s| s.id.to_s }
    ids.filter_map { |id| found[id.to_s] }
  end

  def drawn_base_scope(section)
    if section.korner_slug.present?
      korner_statuses(section.korner_slug)
    elsif section.tag_name.present?
      kategory_statuses(section.tag_name)
    else
      Status.none
    end
  end

  def korner_statuses(slug)
    manifest = Kronk::KornerRegistry.find(slug)
    return Status.none unless manifest

    scope = @account.statuses

    # Prefer the has_one association when the manifest declares one;
    # fall back to post_type discriminator otherwise. Both are common
    # patterns in the shipping manifests.
    if (assoc = manifest.status_association)
      scope.joins(assoc).distinct
    elsif (post_type = manifest.status_post_type)
      scope.where(post_type: Status.post_types[post_type.to_sym])
    else
      Status.none
    end
  rescue ActiveRecord::ConfigurationError
    Status.none
  end

  def kategory_statuses(tag_name)
    tag = Tag.find_by(name: tag_name.downcase)
    return Status.none unless tag

    @account.statuses.joins(:tags).where(tags: { id: tag.id })
  end
end
