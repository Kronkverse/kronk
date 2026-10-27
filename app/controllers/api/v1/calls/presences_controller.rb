# frozen_string_literal: true

# Who is in one of Kronk's calls before you join it: the Main Huddle's lobby
# and a live set's listener count (docs/spaces/huddle.md, Jitsi server).
#
#   GET /api/v1/calls/presence?kind=huddle|kuddle|booth_live&id=
#     -> { names: [..], count: <n> }   (names and count null if Jitsi can't say)
#
# The Jitsi server answers who-is-here only to Kronk, so browsers ask here,
# and only about a call they could join (Kronk::CallTarget): someone who
# can't see it gets a 404.
class Api::V1::Calls::PresencesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read }
  before_action :require_user!

  def show
    target = Kronk::CallTarget.find!(params[:kind], params[:id])
    raise ActiveRecord::RecordNotFound unless target.visible_to?(current_account)

    names = Kronk::HuddleCount.who(target.room_key)
    render json: { names: names, count: names&.size }
  end
end
