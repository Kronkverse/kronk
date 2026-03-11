# frozen_string_literal: true

class HuddleController < ApplicationController
  include WebAppControllerConcern

  before_action :authenticate_user!

  def index
    expires_in(0, public: false)
  end
end
