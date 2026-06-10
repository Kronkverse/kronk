# frozen_string_literal: true

class FlowController < ApplicationController
  include WebAppControllerConcern

  before_action :require_user!

  def index; end
end
