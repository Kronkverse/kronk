# frozen_string_literal: true

# A call's recordings, for the people allowed to see them
# (docs/spaces/huddle.md, Recordings; CallRecordingPolicy).
#
#   GET /api/v1/calls/recordings?kind=&id=  -> [recording, …] ready ones,
#       newest first, each with short-lived signed `url` (play) and
#       `download_url`. 404 for a call you can't see; [] for a live set
#       that isn't yours.
#
# There is no way to delete one: once recorded, a recording is kept
# (docs/decisions.md, 2026-10-29).
class Api::V1::Calls::RecordingsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read }, only: [:index]
  before_action :require_user!

  def index
    target = Kronk::CallTarget.find!(params[:kind], params[:id])
    raise ActiveRecord::RecordNotFound unless target.visible_to?(current_account) || target.recordings_visible_to?(current_account)
    return render json: [] unless target.recordings_visible_to?(current_account) && Kronk::CallRecordingStorage.available?

    response.headers['Cache-Control'] = 'private, no-store'
    render json: CallRecording.for_target(target).limit(50),
           each_serializer: REST::CallRecordingSerializer
  end
end
