# frozen_string_literal: true

# An event's schedule (docs/spaces/kalendar.md, Schedule): read by anyone
# who can see the event, its lines added, changed and removed by its host
# or, when it is Konnected to a projekt, by anyone in the projekt
# (Kronk::EventSchedule).
#
#   GET    /api/v1/events/:event_id/schedule
#   POST   /api/v1/events/:event_id/schedule/lines      (day, start, end, title, note)
#   PATCH  /api/v1/events/:event_id/schedule/lines/:id
#   DELETE /api/v1/events/:event_id/schedule/lines/:id
class Api::V1::Events::SchedulesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: :show
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, except: :show
  before_action :require_user!
  before_action :set_event
  before_action :require_editor!, except: :show
  before_action :set_line, only: [:update, :destroy]

  def show
    render json: schedule_json
  end

  def create
    line = @event.schedule_lines.new(line_params.merge(created_by_account: current_account))
    return render_invalid(line) unless line.save

    render json: schedule_json
  end

  def update
    return render_invalid(@line) unless @line.update(line_params)

    render json: schedule_json
  end

  def destroy
    @line.destroy!
    render json: schedule_json
  end

  private

  # Not found, not forbidden: a guessed name mustn't tell anyone a hidden
  # event exists (as EventsController).
  def set_event
    @event = Event.by_link!(params[:event_id])
    raise ActiveRecord::RecordNotFound unless @event.visible_to?(current_account)

    @projekt = Kronk::EventSchedule.projekt_for(@event)
  end

  def require_editor!
    raise Mastodon::NotPermittedError unless editor?
  end

  def editor?
    Kronk::EventSchedule.can_edit?(@event, current_account, projekt: @projekt)
  end

  def set_line
    @line = @event.schedule_lines.find(params[:id])
  end

  # `start` and `end` are "HH:MM" on the event's own clock; an empty end
  # clears it.
  def line_params
    attrs = params.permit(:day, :title, :note).to_h
    attrs[:start_minute] = EventScheduleLine.minutes(params[:start]) if params.key?(:start)
    attrs[:end_minute] = EventScheduleLine.minutes(params[:end]) if params.key?(:end)
    attrs
  end

  def render_invalid(line)
    render json: { error: line.errors.full_messages.to_sentence }, status: 422
  end

  def schedule_json
    {
      lines: @event.schedule_lines.reload.map { |line| line_json(line) },
      can_edit: editor?,
      projekt: @projekt && { id: @projekt.id.to_s, title: @projekt.title.to_s },
    }
  end

  def line_json(line)
    {
      id: line.id.to_s,
      day: line.day.iso8601,
      start: EventScheduleLine.clock(line.start_minute),
      end: EventScheduleLine.clock(line.end_minute),
      title: line.title,
      note: line.note,
    }
  end
end
