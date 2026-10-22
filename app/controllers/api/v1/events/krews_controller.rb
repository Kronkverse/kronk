# frozen_string_literal: true

# Link an event you made, coming up or past, to a Krew you're in, or
# unlink it (docs/spaces/krew.md, Linking). A Krew is an audience on the
# event's post, so linking adds it there: the event shows on the Krew's
# page and its members can open it. An invite-only event stays for its
# invitees (Event#visible_to? never reads its post's audience). The Krew's
# emergence, if it has one, gets the event too (Kronk::EventLinks).
#
# Only the event's maker links. Either end can unlink (decisions.md,
# 2026-10-21): the maker, or anyone in the Krew.
#
#   POST   /api/v1/events/:event_id/krews      (krew_id)
#   DELETE /api/v1/events/:event_id/krews/:id
class Api::V1::Events::KrewsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }
  before_action :require_user!
  before_action :set_event, only: :create

  def create
    return render json: { error: 'invite_only' }, status: 422 if @event.invite_only? || @event.status_id.nil?

    krew = current_account.krews.find(params[:krew_id])
    return render json: { error: 'krew is archived' }, status: 422 if krew.archived?

    Kronk::StatusKrews.add(@event.status_id, krew.id)
    Kronk::EventLinks.linked_from_krew(@event, krew, current_account)
    render_empty
  end

  def destroy
    event = Event.find(params[:event_id])
    krew = Krew.find_by(id: params[:id])
    maker = event.account_id == current_account.id
    raise ActiveRecord::RecordNotFound unless maker || krew&.member?(current_account)

    krew ? Kronk::EventLinks.unlinked_from_krew(event, krew) : Kronk::StatusKrews.remove(event.status_id, params[:id])
    render_empty
  end

  private

  def set_event
    @event = current_account.events.find(params[:event_id])
  end
end
