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
  MANAGEMENT_ACTIONS = %i(create update destroy join leave attach detach regenerate_invite add_requirement remove_requirement).freeze
  MEMBER_ACTIONS = %i(show members update destroy join leave attach detach regenerate_invite add_requirement remove_requirement).freeze

  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:index, :show, :members]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: MANAGEMENT_ACTIONS
  before_action :require_user!, only: MANAGEMENT_ACTIONS
  before_action :set_krew, only: MEMBER_ACTIONS

  DEFAULT_LIMIT = 40

  def index
    scope = case params[:scope]
            when 'mine'
              # Krews the viewer belongs to (member or seeder). Includes
              # non-listed ones — private krews only surface here.
              current_account.krews.reorder(last_activity_at: :desc)
            when 'all'
              # Listed + viewer's own, union'd. Useful for the Ж menu
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

  # GET /api/v1/krews/:id/members — the accounts in this Krew (the "who's
  # in it" faces on the detail page). Capped; the count lives on the Krew.
  def members
    accounts = @krew.members.merge(Account.without_suspended).limit(DEFAULT_LIMIT)
    render json: accounts, each_serializer: REST::AccountSerializer
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
    # demand via #regenerate_invite.
    krew_attrs[:invite_token] = SecureRandom.urlsafe_base64(Krew::INVITE_TOKEN_BYTES) if access != 'open'

    krew = Krew.new(krew_attrs)

    ActiveRecord::Base.transaction do
      krew.save!
      krew.krew_memberships.create!(account: current_account, role: 'seeder', source: 'direct')
      attach_korners!(krew, params[:korner_attachments])
      attach_requirements!(krew, params[:requirements])
    end

    send_invites!(krew, params[:invite_account_ids])

    render json: krew.reload, serializer: REST::KrewSerializer, scope: current_user
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: 422
  end

  # POST /api/v1/krews/:id/attach — attach a Korner to this Krew.
  # Seeder-only. Idempotent by (krew, korner) uniqueness.
  #
  #   { korner: 'kalendar' } → creates KrewKorner row
  def attach
    return render json: { error: 'seeders only' }, status: 403 unless @krew.seeder?(current_account)

    slug = params.require(:korner).to_s
    return render json: { error: 'unknown_korner' }, status: 422 unless KrewKorner::KORNERS.include?(slug)

    @krew.krew_korners.find_or_create_by!(korner: slug)
    render json: @krew.reload, serializer: REST::KrewSerializer, scope: current_user
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: 422
  end

  # DELETE /api/v1/krews/:id/attach/:korner — detach.
  def detach
    return render json: { error: 'seeders only' }, status: 403 unless @krew.seeder?(current_account)

    @krew.krew_korners.where(korner: params[:korner].to_s).destroy_all
    render json: @krew.reload, serializer: REST::KrewSerializer, scope: current_user
  end

  # POST /api/v1/krews/:id/regenerate_invite — rotate the invite token.
  # Any outstanding invite link built from the previous token becomes
  # invalid the moment this returns.
  def regenerate_invite
    return render json: { error: 'seeders only' }, status: 403 unless @krew.seeder?(current_account)

    @krew.regenerate_invite_token!
    render json: @krew, serializer: REST::KrewSerializer, scope: current_user
  end

  # POST /api/v1/krews/:id/requirements — add a KrewRequirement.
  # ANDed with any existing rows at join time (§4).
  #
  #   { kind: 'located_in', region: 'Melbourne' }
  #   { kind: 'attending_event', event_id: 42 }
  #   { kind: 'vouched_by_member', vouch_params: { min: 1 } }
  def add_requirement
    return render json: { error: 'seeders only' }, status: 403 unless @krew.seeder?(current_account)

    row = @krew.krew_requirements.create!(requirement_params)
    render json: @krew.reload, serializer: REST::KrewSerializer, scope: current_user, meta: { requirement_id: row.id.to_s }
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: 422
  end

  # DELETE /api/v1/krews/:id/requirements/:requirement_id — remove.
  def remove_requirement
    return render json: { error: 'seeders only' }, status: 403 unless @krew.seeder?(current_account)

    @krew.krew_requirements.where(id: params[:requirement_id]).destroy_all
    render json: @krew.reload, serializer: REST::KrewSerializer, scope: current_user
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

  # Invite people on create. Each selected local account gets a directed nudge
  # with a CTA into the Krew — they choose to join (no forced membership,
  # matching the Krew join-freely model). Best-effort: skips self, non-local,
  # and invalid ids; a nudge failure never fails the create (it runs outside
  # the save transaction).
  def send_invites!(krew, account_ids)
    ids = Array(account_ids).map(&:to_i).reject(&:zero?).uniq - [current_account.id]
    return if ids.empty?

    Account.local.where(id: ids).find_each do |account|
      Nudges::EventRouter.deliver(
        actor: current_account,
        recipient: account,
        source_korner_slug: 'krew',
        verb: 'krew_invite',
        source_type: 'Krew',
        source_id: krew.id,
        interaction: 'interactive',
        cta_label: krew.name,
        cta_route: "/hub/krew/#{krew.slug}",
        directed: true
      )
    end
  end

  # Inline korner attachments on create (Phase 4c). Accepts an array
  # of slug strings; silently drops anything not in KrewKorner::KORNERS
  # rather than 422-ing the whole create.
  def attach_korners!(krew, slugs)
    Array(slugs).each do |slug|
      next unless KrewKorner::KORNERS.include?(slug.to_s)

      krew.krew_korners.find_or_create_by!(korner: slug.to_s)
    end
  end

  # Inline requirements on create. Each entry is a hash with `kind`
  # and kind-specific data. Skips entries with an unknown kind; the
  # model's kind_carries_expected_data validation catches malformed
  # rows.
  def attach_requirements!(krew, rows)
    Array(rows).each do |row|
      row = row.to_unsafe_h if row.respond_to?(:to_unsafe_h)
      next if row.blank?
      next unless KrewRequirement::KINDS.include?(row['kind'] || row[:kind])

      krew.krew_requirements.create!(
        kind: row['kind'] || row[:kind],
        event_id: row['event_id'] || row[:event_id],
        region: row['region'] || row[:region],
        vouch_params: row['vouch_params'] || row[:vouch_params]
      )
    end
  end

  def requirement_params
    params.permit(:kind, :event_id, :region, vouch_params: {})
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
