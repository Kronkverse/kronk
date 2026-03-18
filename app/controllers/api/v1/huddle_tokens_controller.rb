# frozen_string_literal: true

class Api::V1::HuddleTokensController < Api::BaseController
  before_action :require_user!

  def show
    payload = {
      aud: 'kronk-huddle',
      iss: 'kronk',
      sub: '*',
      room: 'huddle',
      exp: 2.hours.from_now.to_i,
      context: {
        user: {
          name: "@#{current_account.username}",
          avatar: current_account.avatar_original_url
        }
      }
    }

    token = JWT.encode(payload, 'Vcjm5RSaqPtXOV3lU0GIR2Og3dN1HFHg', 'HS256', { typ: 'JWT' })

    render json: { token: token }
  end
end
