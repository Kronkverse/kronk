# frozen_string_literal: true

class KlotController < ApplicationController
  include WebAppControllerConcern

  skip_before_action :require_functional!, only: [:index]

  def index; end
end
