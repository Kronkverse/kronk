# frozen_string_literal: true

# Kronk Krews (§Krews) — a shareable audience-scoping primitive.
# Seeded (not owned); membership is opt-in. Phase 3a extends create
# to set the single seeded_by_account_id + access enum + initial
# invite token; endpoints for regenerating the token and managing
# Korner attachments / requirements land with Phase 4's UI.
#
#   GET    /api/v1/krews             (discoverable listing)
#   GET    /api/v1/krews/:id
#   POST   /api/v1/krews             (create; creator becomes seeder)
#   PATCH  /api/v1/krews/:id         (seeder-only)
#   DELETE /api/v1/krews/:id         (seeder-only; archives)
#   POST   /api/v1/krews/:id/join
#   POST   /api/v1/krews/:id/leave
class Api::V1::KrewsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:create, :update, :destroy, :join, :leave]
  before_action :require_user!, only: [:create, :update, :destroy, :join, :leave]
  before_action :set_krew, only: [:show, :update, :destroy, :join, :leave]

  DEFAULT_LIMIT = 40

  def index
    scope = case params[:scope]
            when 'mine'
              # Krews the viewer belongs to (member or seeder). Includes
              # non-listed ones — private krews only surface here.
              current_account.krews.reorder(last_activity_at: :desc)
            when 'all'
              # Listed + viewer's own, union'd. Useful for the Ӂ menu
              # "Krews" surface where users want both.
              listed = Krew.listed
              mine   = current_account&.krews || Krew.none
              Krew.where(id: listed.select(:id)).or(Krew.where(id: mine.select(:id))).reorder(last_activity_at: :desc)
            else
              Krew.listed.order(last_activity_at: :desc)
            end

    scope = scope.limit(limit_param(DEFAULT_LIMIT))
    scope = scope.where(Krew.arel_table[:id].lt(params[:max_id])) if params[:max_id].present?
    scope = scope.where(Krew.arel_table[:id].gt(params[:min_id])) if params[:min_id].present?

    render json: scope, each_serializer: REST::KrewSerializer, scope: current_user
  end

  def show
    render json: @krew, serializer: REST::KrewSerializer, scope: current_user
  end

  def create
    access = normalize_access_param(create_params[:access], create_params[:discoverable])
    krew_attrs = create_params.slice(:slug, :name, :description, :governance_framework, :governance_threshold).merge(
      access: access,
      seeded_by: current_account,
      last_activity_at: Time.current
    )

    # For anything not-open, plant an initial invite token so the
    # seeder can share the private surface immediately. Rotates on
    # demand via the invite-regenerate endpoint (Phase 4).
    krew_attrs[:invite_token] = SecureRandom.urlsafe_base64(Krew::INVITE_TOKEN_BYTES) if access != 'open'

    krew = Krew.new(krew_attrs)

    ActiveRecord::Base.transaction do
      krew.save!
      krew.krew_memberships.create!(account: current_account, role: 'seeder', source: 'direct')
    end

    render json: krew, serializer: REST::KrewSerializer, scope: current_user
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: 422
  end

  def update
    return render json: { error: 'seeders only' }, status: 403 unless @krew.seeder?(current_account)

    attrs = update_params.to_h
    attrs['access'] = normalize_access_param(attrs.delete('access'), attrs.delete('discoverable')) if attrs.key?('access') || attrs.key?('discoverable')

    @krew.update!(attrs)
    render json: @krew, serializer: REST::KrewSerializer, scope: current_user
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: 422
  end

  def destroy
    return render json: { error: 'seeders only' }, status: 403 unless @krew.seeder?(current_account)

    @krew.update!(archived_at: Time.current)
    render json: @krew, serializer: REST::KrewSerializer, scope: current_user
  end

  def join
    return render json: @krew, serializer: REST::KrewSerializer, scope: current_user if @krew.member?(current_account)

    source = determine_join_source
    return render json: { error: 'invite_required' }, status: 403 if @krew.invite_only? && source != 'invite'
    return render json: gate_error, status: 403 if @krew.requirement_gated? && !requirements_satisfied?

    @krew.krew_memberships.create!(account: current_account, role: 'member', source: source)
    @krew.touch_activity!
    render json: @krew, serializer: REST::KrewSerializer, scope: current_user
  end

  def leave
    membership = @krew.krew_memberships.find_by(account: current_account)
    return render json: @krew, serializer: REST::KrewSerializer, scope: current_user if membership.nil?

    # Brief §8: free to leave. The last-seeder guard survives from the
    # multi-seeder model — a legacy check that stays until the
    # governance retire lands, so a Krew never ends up seederless
    # under the current shape.
    return render json: { error: 'cannot leave — you are the last seeder. Nominate another first or archive the krew.' }, status: 422 if membership.role == 'seeder' && @krew.krew_memberships.where(role: 'seeder').one?

    membership.destroy!
    render json: @krew, serializer: REST::KrewSerializer, scope: current_user
  end

  private

  # Accept either the numeric ID or the Krew's slug. Krew#SLUG_PATTERN
  # requires a leading letter, so a slug can never be confused with a
  # numeric id — the disjunction is disjoint at the format level.
  def set_krew
    @krew = Krew.find_by(slug: params[:id]) || Krew.find(params[:id])
  end

  def create_params
    params.permit(:slug, :name, :description, :access, :discoverable, :governance_framework, :governance_threshold)
  end

  def update_params
    params.permit(:name, :description, :access, :discoverable, :governance_framework, :governance_threshold)
  end

  # Bridge param shape: prefer explicit `access`; otherwise translate
  # the legacy `discoverable` boolean (`true → open`, `false →
  # invite_only`). Rejects unknown values so callers can't smuggle
  # extra states through param aliasing.
  def normalize_access_param(access, discoverable)
    return access if Krew::ACCESS_LEVELS.include?(access.to_s)

    ActiveModel::Type::Boolean.new.cast(discoverable) == false ? 'invite_only' : 'open'
  end

  def determine_join_source
    params[:k].present? && params[:k] == @krew.invite_token ? 'invite' : 'direct'
  end

  def requirements_satisfied?
    @krew.krew_requirements.all? { |req| requirement_met?(req) }
  end

  def requirement_met?(req)
    case req.kind
    when 'attending_event'
      req.event_id.present? && EventRsvp.status_going.exists?(event_id: req.event_id, account_id: current_account.id)
    when 'located_in'
      # Region match is user-declared; no coordinate storage per §8
      # ("no precise coordinates"). Wired to the coarse region hint
      # the account has opted into; treat missing as unmet.
      current_account.respond_to?(:declared_region) && current_account.declared_region == req.region
    else
      # vouched_by_member is provisional (Anthemos DID vouch, not yet
      # wired) — treat as unmet until the vouch layer lands. Same
      # answer for anything that slipped past the KINDS validation.
      false
    end
  end

  def gate_error
    {
      error: 'requirements_unmet',
      unmet: @krew.krew_requirements.reject { |r| requirement_met?(r) }.map(&:kind),
    }
  end
end
