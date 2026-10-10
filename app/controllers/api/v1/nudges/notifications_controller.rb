# frozen_string_literal: true

# The notifications list: every nudge event addressed to the current account,
# across all chats, newest first (docs/spaces/nudges.md (Nudges spec)
# § Notifications list).
#
#   GET  /api/v1/nudges/notifications?before=<iso8601>&limit=
#   GET  /api/v1/nudges/notifications/unseen_count
#   POST /api/v1/nudges/notifications/seen?up_to=<iso8601>
#
# One entry per group (see Nudges::NotificationFeed):
#   {
#     "id":                 "<newest event id>",
#     "source_korner_slug": "feed",
#     "verb":               "frothed",
#     "source_type":        "Status",
#     "source_id":          "42",
#     "interaction":        "passive",
#     "cta_label":          null,
#     "route":              "/statuses/42",           # where a tap goes
#     "subject":            "First line of the post", # null if gone or not yours to see
#     "created_at":         "2026-10-10T01:23:45Z",
#     "seen":               false,
#     "count":              3,
#     "actors":             [<AccountJSON>, ...]      # newest first, capped
#   }
class Api::V1::Nudges::NotificationsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:notifications' }, only: [:index, :unseen_count]
  before_action -> { doorkeeper_authorize! :write, :'write:notifications' }, only: [:seen]
  before_action :require_user!

  ACTORS_SHOWN = 3

  def index
    before = parse_time(params[:before])
    return render(json: { error: 'bad_before' }, status: 400) if params[:before].present? && before.nil?

    as_of = Time.current
    feed  = Nudges::NotificationFeed.new(current_account, before: before, limit: params[:limit])
    @subjects = Nudges::NotificationSubjects.new(feed.groups.map(&:newest), viewer: current_account)

    render json: {
      notifications: feed.groups.map { |group| serialize_group(group) },
      next_before: feed.next_before&.iso8601(6),
      unseen_count: Nudges::NotificationFeed.unseen_count(current_account),
      # Hand this back as `up_to` when marking seen, so the cut-off is the
      # server's clock and not the browser's.
      as_of: as_of.iso8601(6),
    }
  end

  def unseen_count
    render json: { unseen_count: Nudges::NotificationFeed.unseen_count(current_account) }
  end

  def seen
    up_to = parse_time(params[:up_to])
    return render(json: { error: 'bad_up_to' }, status: 400) if params[:up_to].present? && up_to.nil?

    Nudges::NotificationFeed.mark_seen!(current_account, up_to: up_to)
    render json: { unseen_count: Nudges::NotificationFeed.unseen_count(current_account) }
  end

  private

  def parse_time(value)
    return nil if value.blank?

    Time.iso8601(value.to_s)
  rescue ArgumentError
    nil
  end

  def serialize_group(group)
    newest = group.newest
    actors = group.actors

    {
      id: newest.id.to_s,
      source_korner_slug: newest.source_korner_slug,
      verb: newest.verb,
      source_type: newest.source_type,
      source_id: newest.source_id&.to_s,
      interaction: newest.interaction,
      cta_label: newest.cta_label,
      route: @subjects.route_for(newest),
      subject: @subjects.title_for(newest),
      created_at: newest.created_at.iso8601,
      seen: group.seen?,
      count: actors.size,
      actors: ActiveModelSerializers::SerializableResource.new(
        actors.first(ACTORS_SHOWN),
        each_serializer: REST::AccountSerializer
      ).as_json,
    }
  end
end
