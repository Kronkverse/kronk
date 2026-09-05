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

  # Curating a shelf means looking at more of your own work at once than
  # reading one does, so the candidate list is allowed a deeper page.
  CANDIDATE_LIMIT = 40

  def index
    render json: sections_scope, each_serializer: REST::ProfileSectionSerializer
  end

  def statuses
    return render(json: []) unless @account.profile_visible_to?(current_user&.account)

    section = @account.profile_sections.find(params[:id])
    return render(json: []) unless section.visible_to?(current_user&.account)

    scope = candidates?(section) ? candidate_scope(section) : statuses_scope_for(section)

    # A `chosen`-order shelf returns a hand-picked Array in the owner's
    # order; skip cursor pagination + limit (the whole curated set is
    # the answer). Everything else is an AR scope.
    if scope.is_a?(ActiveRecord::Relation)
      scope = scope.where(Status.arel_table[:id].lt(params[:max_id])) if params[:max_id].present?
      scope = scope.where(Status.arel_table[:id].gt(params[:min_id])) if params[:min_id].present?
      scope = scope.limit(limit_param(candidates?(section) ? CANDIDATE_LIMIT : DEFAULT_LIMIT))
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

  # The owner arranging a shelf needs what the shelf COULD show, not what it
  # currently shows — asking a `chosen` shelf what is on it can only ever
  # take posts off. Owner-only: to anyone else `candidates=1` is ignored and
  # the shelf answers normally.
  def candidates?(section)
    return false unless truthy_param?(:candidates)

    section.account_id == current_user&.account_id
  end

  # Uncurated, newest first — the same manifest-resolved query the read side
  # builds on, with the owner's ordering left out of it.
  def candidate_scope(section)
    drawn_base_scope(section).reorder(id: :desc)
  end

  def set_account
    @account = Account.find(params[:account_id])
  end

  # Only shelves visible to the viewer per the five-scope ladder —
  # Ruby-side filter after fetch is fine at profile-page scale
  # (dozens of rows). Kept alongside the `visible` boolean the owner
  # toggles.
  def sections_scope
    viewer = current_user&.account
    # Account-level profile privacy gate (see CardsController): a viewer
    # who can't see this profile gets none of its shelves.
    return [] unless @account.profile_visible_to?(viewer)

    @account.profile_sections.shown.ordered.select { |s| s.visible_to?(viewer) }
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
