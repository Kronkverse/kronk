# frozen_string_literal: true

# Kuestions v2 REST controller — the swipe deck's data spine.
#
# The legacy `/api/v1/questions` controller (Status-polymorphic
# resolver) stays in place for one release so shadow + prod keep
# working during the cutover. See docs/spaces/kuestions.md.
#
# Endpoints:
#
#   GET   /api/v2/kuestions        # deck for the current user
#   GET   /api/v2/kuestions/:id    # one Kuestion + gated answers
#   POST  /api/v2/kuestions        # ask a new Kuestion
#
# Answer POST + skip POST/DELETE live under the nested controllers.
class Api::V2::KuestionsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create]
  before_action :require_user!
  before_action :set_question, only: [:show]

  DEFAULT_LIMIT = 20
  MAX_LIMIT     = 50

  def index
    scope = Question.deck_for(current_account).limit(clamp_limit)
    render json: scope, each_serializer: REST::Kuestions::QuestionSerializer, scope: current_account
  end

  def show
    render json: @question, serializer: REST::Kuestions::QuestionSerializer,
           scope: current_account,
           with_answers: true
  end

  def create
    question = Question.new(
      title: params.require(:title).to_s.strip,
      prompt: params[:prompt].presence,
      answer_format: params[:answer_format].presence || 'text',
      mc_options: mc_options_param,
      created_by_account: current_account,
      locked: true
    )

    if question.save
      render json: question, serializer: REST::Kuestions::QuestionSerializer, scope: current_account, status: 201
    else
      render json: { error: question.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  private

  def set_question
    @question = Question.find(params[:id])
  end

  def clamp_limit
    [params.fetch(:limit, DEFAULT_LIMIT).to_i, MAX_LIMIT].min.clamp(1, MAX_LIMIT)
  end

  # `mc_options` accepts either `["a","b"]` (label-only) or
  # `[{"label"=>"a"}, ...]`. Normalises to the object shape the model
  # stores.
  def mc_options_param
    raw = params[:mc_options]
    return [] if raw.blank?

    Array(raw).filter_map do |o|
      case o
      when String then { 'label' => o.to_s.strip }
      when Hash, ActionController::Parameters
        { 'label' => o[:label].to_s.strip }
      end
    end
  end
end
