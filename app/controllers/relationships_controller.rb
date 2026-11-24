# frozen_string_literal: true

# The Follows and followers page is retired (Tal, 2026-11-24): Mates is the
# relationship Kronk shows, and the one-way connections it listed now sit
# under your own Mates list (Api::V1::Kommunity::NotYetMatesController).
# The path redirects there, since links to it exist.
class RelationshipsController < ApplicationController
  before_action :authenticate_user!

  def show
    redirect_to "/@#{current_account.username}/mates"
  end
end
