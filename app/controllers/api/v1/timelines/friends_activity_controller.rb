# frozen_string_literal: true

class Api::V1::Timelines::FriendsActivityController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }
  before_action :require_user!

  after_action :insert_pagination_headers, unless: -> { @grouped_activities.empty? }

  LIMIT = 20

  def show
    @grouped_activities = load_grouped_activities
    render json: @grouped_activities
  end

  private

  def load_grouped_activities
    followed_ids = current_account.following.pluck(:id)
    return [] if followed_ids.empty?

    activities = fetch_raw_activities(followed_ids)
    grouped = group_by_target_status(activities)
    resolve_and_format(grouped)
  end

  def fetch_raw_activities(followed_ids)
    ids_list = followed_ids.join(',')

    boosts_sql = <<~SQL.squish
      SELECT reblog_of_id AS target_status_id, account_id, 'boost' AS activity_type, id AS activity_id, created_at
      FROM statuses
      WHERE account_id IN (#{ids_list})
        AND deleted_at IS NULL
        AND reblog_of_id IS NOT NULL
        AND account_id != #{current_account.id}
    SQL

    favourites_sql = <<~SQL.squish
      SELECT status_id AS target_status_id, account_id, 'favourite' AS activity_type, id AS activity_id, created_at
      FROM favourites
      WHERE account_id IN (#{ids_list})
        AND account_id != #{current_account.id}
    SQL

    replies_sql = <<~SQL.squish
      SELECT in_reply_to_id AS target_status_id, account_id, 'reply' AS activity_type, id AS activity_id, created_at
      FROM statuses
      WHERE account_id IN (#{ids_list})
        AND deleted_at IS NULL
        AND in_reply_to_id IS NOT NULL
        AND account_id != #{current_account.id}
    SQL

    query = <<~SQL.squish
      SELECT * FROM (
        (#{boosts_sql}) UNION ALL (#{favourites_sql}) UNION ALL (#{replies_sql})
      ) AS activities
      ORDER BY created_at DESC
    SQL

    ActiveRecord::Base.connection.select_all(query).to_a
  end

  def group_by_target_status(activities)
    grouped = {}

    activities.each do |row|
      target_id = row['target_status_id'].to_s
      grouped[target_id] ||= { interactions: [], latest_at: nil }
      grouped[target_id][:interactions] << {
        type: row['activity_type'],
        account_id: row['account_id'].to_s,
        created_at: row['created_at'],
      }

      ts = row['created_at']
      if grouped[target_id][:latest_at].nil? || ts > grouped[target_id][:latest_at]
        grouped[target_id][:latest_at] = ts
      end
    end

    sorted = grouped.sort_by { |_, v| v[:latest_at] }.reverse

    if params[:max_id].present?
      max_id = params[:max_id].to_i
      sorted = sorted.select { |target_id, _| target_id.to_i < max_id }
    end

    if params[:since_id].present?
      since_id = params[:since_id].to_i
      sorted = sorted.select { |target_id, _| target_id.to_i > since_id }
    end

    sorted.first(limit_param)
  end

  def resolve_and_format(grouped_pairs)
    return [] if grouped_pairs.empty?

    target_ids = grouped_pairs.map(&:first)
    account_ids = grouped_pairs.flat_map { |_, v| v[:interactions].map { |i| i[:account_id] } }.uniq

    statuses = Status.where(id: target_ids).includes(:account, :media_attachments, :preloadable_poll, reblog: :account).index_by { |s| s.id.to_s }
    accounts = Account.where(id: account_ids).index_by { |a| a.id.to_s }

    grouped_pairs.filter_map do |target_id, data|
      status = statuses[target_id]
      next unless status

      interactions = data[:interactions].filter_map do |interaction|
        account = accounts[interaction[:account_id]]
        next unless account

        {
          type: interaction[:type],
          account: ActiveModelSerializers::SerializableResource.new(account, serializer: REST::AccountSerializer),
          created_at: interaction[:created_at],
        }
      end

      next if interactions.empty?

      {
        id: target_id,
        status: ActiveModelSerializers::SerializableResource.new(status, serializer: REST::StatusSerializer, scope: current_user, scope_name: :current_user),
        interactions: interactions,
      }
    end
  end

  def limit_param
    params[:limit].present? ? [params[:limit].to_i.abs, 40].min : LIMIT
  end

  def insert_pagination_headers
    set_pagination_headers(next_path, prev_path)
  end

  def next_path
    return unless @grouped_activities.size >= limit_param

    api_v1_timelines_friends_activity_url(pagination_params(max_id: @grouped_activities.last&.dig(:id)))
  end

  def prev_path
    api_v1_timelines_friends_activity_url(pagination_params(since_id: @grouped_activities.first&.dig(:id)))
  end

  def pagination_params(core_params)
    params.slice(:limit).permit(:limit).merge(core_params)
  end

  def set_pagination_headers(next_url, prev_url)
    links = []
    links << %(<#{next_url}>; rel="next") if next_url
    links << %(<#{prev_url}>; rel="prev") if prev_url
    response.headers['Link'] = links.join(', ') if links.any?
  end
end
