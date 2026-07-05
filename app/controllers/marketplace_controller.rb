# frozen_string_literal: true

class MarketplaceController < ApplicationController
  include WebAppControllerConcern

  skip_before_action :require_functional!, only: [:index]

  def index; end
end
