# frozen_string_literal: true

class Api::V1::Klot::SettingsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read,  :'read:statuses' },  only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:update]
  before_action :require_user!

  def show
    render json: KlotSetting.for(current_account), serializer: REST::KlotSettingSerializer
  end

  def update
    settings = KlotSetting.for(current_account)
    settings.update!(setting_params)
    render json: settings, serializer: REST::KlotSettingSerializer
  end

  private

  def setting_params
    params.permit(:cycle_length, :period_length)
  end
end
