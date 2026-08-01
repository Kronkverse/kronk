# frozen_string_literal: true

# Read-only listing of another account's public sections. Powers the
# sectioned /@user profile — a viewer fetches the target account's
# sections here (not their own).
#
#   GET /api/v1/accounts/:account_id/profile/sections
#   GET /api/v1/accounts/:account_id/profile/sections/:id/statuses
#
# Statuses returned are filtered per section type:
#   timeline   → the account's chronological public statuses
#   korner     → statuses linked to the section's korner via the
#                 manifest's feed_projection.status_association
#   kategory   → statuses tagged with the section's curated Tag
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
    scope   = statuses_scope_for(section)

    scope = scope.where(Status.arel_table[:id].lt(params[:max_id])) if params[:max_id].present?
    scope = scope.where(Status.arel_table[:id].gt(params[:min_id])) if params[:min_id].present?
    scope = scope.limit(limit_param(DEFAULT_LIMIT))

    # Route through the same visibility gate every other statuses
    # endpoint uses (Api::V1::StatusesController#index, thread lookups,
    # etc). Without this, a `direct` / `private` / krew-scoped status
    # bound to this shelf renders to any viewer — the shelf's per-post
    # visibility is enforced only here.
    @statuses = Status.permitted_statuses_from_ids(scope.pluck(:id), current_user&.account, stable: true)

    render json: @statuses,
           each_serializer: REST::StatusSerializer,
           relationships: StatusRelationshipsPresenter.new(@statuses, current_user&.account_id)
  end

  private

  def set_account
    @account = Account.find(params[:account_id])
  end

  def sections_scope
    @account.profile_sections.visible.ordered
  end

  # Section-type dispatch. All queries build off account.statuses so the
  # section can never leak content the account didn't post. Visibility
  # gating (private / DM) still runs through the standard Status
  # policies at render time.
  def statuses_scope_for(section)
    case section.section_type
    when 'timeline'
      @account.statuses.without_replies.reorder(id: :desc)
    when 'korner'
      korner_statuses(section.korner_slug)
    when 'kategory'
      kategory_statuses(section.tag_name)
    else
      Status.none
    end
  end

  def korner_statuses(slug)
    return Status.none if slug.blank?

    manifest = Kronk::KornerRegistry.find(slug)
    return Status.none unless manifest

    scope = @account.statuses.reorder(id: :desc)

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
    return Status.none if tag_name.blank?

    tag = Tag.find_by(name: tag_name.downcase)
    return Status.none unless tag

    @account.statuses.joins(:tags).where(tags: { id: tag.id }).reorder(id: :desc)
  end
end
