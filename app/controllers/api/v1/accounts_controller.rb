# frozen_string_literal: true

class Api::V1::AccountsController < Api::BaseController
  include RegistrationHelper
  include RoutingHelper

  before_action -> { authorize_if_got_token! :read, :'read:accounts' }, except: [:create, :follow, :unfollow, :remove_from_followers, :block, :unblock, :mute, :unmute, :nudge, :nudge_streak, :nudge_partners, :nudge_history, :nudge_pending_count]
  before_action -> { doorkeeper_authorize! :follow, :write, :'write:follows' }, only: [:follow, :unfollow, :remove_from_followers]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:nudge]
  before_action -> { doorkeeper_authorize! :follow, :write, :'write:mutes' }, only: [:mute, :unmute]
  before_action -> { doorkeeper_authorize! :follow, :write, :'write:blocks' }, only: [:block, :unblock]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:create]

  before_action :require_user!, except: [:index, :show, :create, :tagged_media]
  before_action :require_client_credentials!, only: [:create]
  before_action :set_account, except: [:index, :create, :nudge_history, :nudge_partners, :nudge_pending_count]
  before_action :set_accounts, only: [:index]
  before_action :check_account_approval, except: [:index, :create, :nudge_history, :nudge_partners, :nudge_pending_count]
  before_action :check_account_confirmation, except: [:index, :create, :nudge_history, :nudge_partners, :nudge_pending_count]
  before_action :check_enabled_registrations, only: [:create]
  before_action :check_accounts_limit, only: [:index]
  before_action :check_following_self, only: [:follow]

  skip_before_action :require_authenticated_user!, only: :create

  override_rate_limit_headers :follow, family: :follows

  def index
    render json: @accounts, each_serializer: REST::AccountSerializer
  end

  def show
    cache_if_unauthenticated!
    render json: @account, serializer: REST::AccountSerializer
  end

  def create
    token    = AppSignUpService.new.call(doorkeeper_token.application, request.remote_ip, account_params)
    response = Doorkeeper::OAuth::TokenResponse.new(token)

    headers.merge!(response.headers)

    self.response_body = Oj.dump(response.body)
    self.status        = response.status
  rescue ActiveRecord::RecordInvalid => e
    render json: ValidationErrorFormatter.new(e, 'account.username': :username, 'invite_request.text': :reason).as_json, status: 422
  end

  def follow
    follow  = FollowService.new.call(current_user.account, @account, reblogs: params.key?(:reblogs) ? truthy_param?(:reblogs) : nil, notify: params.key?(:notify) ? truthy_param?(:notify) : nil, languages: params.key?(:languages) ? params[:languages] : nil, with_rate_limit: true)
    options = @account.locked? || current_user.account.silenced? ? {} : { following_map: { @account.id => { reblogs: follow.show_reblogs?, notify: follow.notify?, languages: follow.languages } }, requested_map: { @account.id => false } }

    render json: @account, serializer: REST::RelationshipSerializer, relationships: relationships(**options)
  end

  def block
    BlockService.new.call(current_user.account, @account)
    render json: @account, serializer: REST::RelationshipSerializer, relationships: relationships
  end

  def mute
    MuteService.new.call(current_user.account, @account, notifications: truthy_param?(:notifications), duration: params[:duration].to_i)
    render json: @account, serializer: REST::RelationshipSerializer, relationships: relationships
  end

  def unfollow
    UnfollowService.new.call(current_user.account, @account)
    render json: @account, serializer: REST::RelationshipSerializer, relationships: relationships
  end

  def remove_from_followers
    RemoveFromFollowersService.new.call(current_user.account, @account)
    render json: @account, serializer: REST::RelationshipSerializer, relationships: relationships
  end

  def unblock
    UnblockService.new.call(current_user.account, @account)
    render json: @account, serializer: REST::RelationshipSerializer, relationships: relationships
  end

  def unmute
    UnmuteService.new.call(current_user.account, @account)
    render json: @account, serializer: REST::RelationshipSerializer, relationships: relationships
  end

  def nudge_history
    doorkeeper_authorize! :read, :'read:accounts'
    a = current_user.account.id

    received = Notification.where(type: 'nudge', account_id: a)
                           .order(id: :desc).limit(200)
                           .map { |n| { direction: 'received', account_id: n.from_account_id.to_s, created_at: n.created_at.iso8601 } }

    sent = Notification.where(type: 'nudge', from_account_id: a)
                       .order(id: :desc).limit(200)
                       .map { |n| { direction: 'sent', account_id: n.account_id.to_s, created_at: n.created_at.iso8601 } }

    all_nudges = (received + sent).sort_by { |n| n[:created_at] }.last(200).reverse

    partner_ids = all_nudges.map { |n| n[:account_id] }.uniq # rubocop:disable Rails/Pluck
    accounts = Account.where(id: partner_ids)

    render json: {
      accounts: ActiveModelSerializers::SerializableResource.new(
        accounts,
        each_serializer: REST::AccountSerializer,
        scope: current_user,
        scope_name: :current_user
      ).as_json,
      nudges: all_nudges,
    }
  end

  def nudge_partners
    doorkeeper_authorize! :read, :'read:accounts'
    a = current_user.account.id

    sent_counts = Notification.where(type: 'nudge', from_account_id: a).group(:account_id).count
    received_counts = Notification.where(type: 'nudge', account_id: a).group(:from_account_id).count

    partner_ids = (sent_counts.keys + received_counts.keys).uniq

    # Fetch the most recent nudge per partner in one query (with message for preview)
    last_nudge_per_partner = {}
    Notification.where(type: 'nudge')
                .where('account_id = ? OR from_account_id = ?', a, a)
                .includes(nudge_message: [:media_attachment])
                .order(id: :desc)
                .each do |n|
      partner_id = n.account_id == a ? n.from_account_id : n.account_id
      last_nudge_per_partner[partner_id] ||= n
    end

    accounts = Account.where(id: partner_ids).index_by(&:id)

    partner_data = partner_ids.filter_map do |id|
      next unless accounts[id]

      last = last_nudge_per_partner[id]
      msg = last&.nudge_message
      msg_type = if msg&.voice_attachment_id.present?
                   'voice'
                 elsif msg&.media_attachment_id.present?
                   msg.media_attachment&.file_content_type&.start_with?('video/') ? 'video' : 'image'
                 elsif msg&.body.present?
                   'text'
                 else
                   'plain'
                 end
      direction = if last.nil?
                    nil
                  elsif last.from_account_id == a
                    'sent'
                  else
                    'received'
                  end
      {
        account_id: id.to_s,
        account: REST::AccountSerializer.new(
          accounts[id],
          scope: current_user,
          scope_name: :current_user
        ).as_json,
        sent_count: sent_counts[id] || 0,
        received_count: received_counts[id] || 0,
        streak: (sent_counts[id] || 0) + (received_counts[id] || 0),
        last_nudge_at: last&.created_at&.iso8601,
        can_nudge_back: last.nil? || last.from_account_id == id,
        last_message: {
          type: msg_type,
          body: msg_type == 'text' ? msg&.body&.truncate(60) : nil,
          direction: direction,
          created_at: last&.created_at&.iso8601,
        },
      }
    end
    partners = partner_data.sort_by { |p| [-(p[:last_nudge_at] ? Time.parse(p[:last_nudge_at]).to_i : 0)] }

    followed_ids = Follow.where(account: current_user.account).pluck(:target_account_id)
    suggestion_ids = (followed_ids - partner_ids - [current_user.account.id]).sample(5)
    suggestion_accs = suggestion_ids.empty? ? [] : Account.where(id: suggestion_ids)

    all_accounts = (accounts.values + suggestion_accs).map do |acc|
      REST::AccountSerializer.new(acc, scope: current_user, scope_name: :current_user).as_json
    end
    suggestions_json = suggestion_accs.map do |acc|
      {
        account_id: acc.id.to_s,
        account: REST::AccountSerializer.new(acc, scope: current_user, scope_name: :current_user).as_json,
      }
    end

    render json: {
      accounts: all_accounts,
      partners: partners,
      pending_count: partners.count { |p| p[:can_nudge_back] },
      grand_total: partners.sum { |p| p[:sent_count] + p[:received_count] },
      total_sent: sent_counts.values.sum,
      total_received: received_counts.values.sum,
      suggestions: suggestions_json,
    }
  end

  def nudge_pending_count
    doorkeeper_authorize! :read, :'read:accounts'
    a = current_user.account.id
    seen = {}
    count = 0
    Notification.where(type: 'nudge')
                .where('account_id = ? OR from_account_id = ?', a, a)
                .order(id: :desc)
                .each do |n|
      partner_id = n.account_id == a ? n.from_account_id : n.account_id
      next if seen[partner_id]

      seen[partner_id] = true
      count += 1 if n.from_account_id == partner_id
    end
    render json: { count: count }
  end

  def nudge
    NudgeService.new.call(
      current_user.account,
      @account,
      text: params[:text].presence,
      media_attachment_id: params[:media_id].presence,
      voice_attachment_id: params[:voice_id].presence,
      in_reply_to_notification_id: params[:in_reply_to_notification_id].presence
    )
    render json: { streak: nudge_streak_count, can_nudge: false }
  rescue Mastodon::NotPermittedError
    render json: { error: 'waiting_for_nudge_back' }, status: 422
  end

  def nudge_streak
    a = current_user.account.id
    b = @account.id
    sent = Notification.where(type: 'nudge', from_account_id: a, account_id: b).count
    received = Notification.where(type: 'nudge', from_account_id: b, account_id: a).count
    render json: {
      streak: sent + received,
      can_nudge: nudge_can_send?,
      sent_count: sent,
      received_count: received,
    }
  end

  def nudge_thread
    doorkeeper_authorize! :read, :'read:accounts'
    a = current_user.account.id
    b = @account.id

    notifications = Notification
                    .where(type: 'nudge')
                    .where(
                      '(account_id = ? AND from_account_id = ?) OR (account_id = ? AND from_account_id = ?)',
                      a, b, b, a
                    )
                    .includes(nudge_message: [:media_attachment, :voice_attachment])
                    .order(id: :asc)
                    .limit(100)

    last = notifications.last
    can_nudge_back = last.nil? || last.from_account_id == b
    streak = notifications.size

    messages_json = notifications.map do |n|
      direction = n.from_account_id == a ? 'sent' : 'received'
      msg = n.nudge_message
      reaction_counts = NudgeReaction.where(notification: n).group(:emoji).count
      me_emoji = NudgeReaction.find_by(notification: n, account_id: a)&.emoji
      reactions = NudgeReaction::ALLOWED_EMOJI.index_with { |emoji| { count: reaction_counts[emoji] || 0, me: me_emoji == emoji } }

      {
        notification_id: n.id.to_s,
        direction: direction,
        created_at: n.created_at.iso8601,
        body: msg&.body,
        media_url: msg&.media_attachment ? full_asset_url(msg.media_attachment.file.url(:original)) : nil,
        media_content_type: msg&.media_attachment&.file_content_type,
        voice_url: msg&.voice_attachment ? full_asset_url(msg.voice_attachment.file.url(:original)) : nil,
        reactions: reactions,
      }
    end

    render json: {
      account: REST::AccountSerializer.new(@account, scope: current_user, scope_name: :current_user).as_json,
      messages: messages_json,
      can_nudge_back: can_nudge_back,
      streak: streak,
    }
  end

  def tagged_media
    cache_if_unauthenticated!

    viewer_is_subject = current_account&.id == @account.id

    visible_visibilities = if viewer_is_subject
                             %i(public unlisted private)
                           else
                             %i(public unlisted)
                           end

    attachments = @account.tagged_in_media
                          .includes(status: :account, media_tags: :account)
                          .where.not(status_id: nil)
                          .joins(:status)
                          .merge(Status.where(visibility: visible_visibilities))
                          .distinct
                          .order(id: :desc)
                          .then { |q| params[:max_id].present? ? q.where(media_attachments: { id: ...params[:max_id].to_i }) : q }
                          .limit(40)

    render json: attachments, each_serializer: REST::TaggedMediaSerializer
  end

  private

  def nudge_streak_count
    a = current_user.account.id
    b = @account.id
    Notification.where(type: 'nudge')
                .where('(account_id = ? AND from_account_id = ?) OR (account_id = ? AND from_account_id = ?)', a, b, b, a)
                .count
  end

  def nudge_can_send?
    a = current_user.account.id
    b = @account.id
    last = Notification.where(type: 'nudge')
                       .where('(account_id = ? AND from_account_id = ?) OR (account_id = ? AND from_account_id = ?)', a, b, b, a)
                       .order(id: :desc).first
    last.nil? || last.from_account_id == b
  end

  def set_account
    @account = Account.find(params[:id])
  end

  def set_accounts
    @accounts = Account.where(id: account_ids).without_unapproved
  end

  def check_account_approval
    raise(ActiveRecord::RecordNotFound) if @account.local? && @account.user_pending?
  end

  def check_account_confirmation
    raise(ActiveRecord::RecordNotFound) if @account.local? && !@account.user_confirmed?
  end

  def check_accounts_limit
    raise(Mastodon::ValidationError) if account_ids.size > DEFAULT_ACCOUNTS_LIMIT
  end

  def check_following_self
    render json: { error: I18n.t('accounts.self_follow_error') }, status: 403 if current_user.account.id == @account.id
  end

  def relationships(**)
    AccountRelationshipsPresenter.new([@account], current_user.account_id, **)
  end

  def account_ids
    Array(accounts_params[:id]).uniq.map(&:to_i)
  end

  def accounts_params
    params.permit(id: [])
  end

  def account_params
    params.permit(:username, :email, :password, :agreement, :locale, :reason, :time_zone, :invite_code, :date_of_birth)
  end

  def invite
    Invite.find_by(code: params[:invite_code]) if params[:invite_code].present?
  end

  def check_enabled_registrations
    forbidden unless allowed_registration?(request.remote_ip, invite)
  end
end
