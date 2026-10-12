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
#                                  # (?filter=answered|mine|involved|profile)
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
  PROFILE_LIMIT = 200

  def index
    return render_profile_kuestions if params[:filter] == 'profile'

    scope = case params[:filter]
            when 'answered'
              Question.active.community
                      .where(id: Answer.where(account_id: current_account.id).select(:question_id))
                      .order(id: :desc)
            when 'mine'
              Question.active.community
                      .where(created_by_account_id: current_account.id)
                      .order(id: :desc)
            when 'involved'
              # The Answered view: what you answered plus what you asked.
              Question.active.community
                      .where(id: Answer.where(account_id: current_account.id).select(:question_id))
                      .or(Question.active.community.where(created_by_account_id: current_account.id))
                      .order(id: :desc)
            else
              Question.deck_for(current_account)
            end
    scope = scope.limit(clamp_limit)
    render json: scope, each_serializer: REST::Kuestions::QuestionSerializer, scope: current_account,
           with_my_answer: params[:filter] == 'involved'
  end

  def show
    render json: @question, serializer: REST::Kuestions::QuestionSerializer,
           scope: current_account,
           with_answers: true
  end

  def create
    profile = params[:kind] == 'profile'
    question = Question.new(
      title: params.require(:title).to_s.strip,
      prompt: params[:prompt].presence,
      answer_format: params[:answer_format].presence || 'text',
      mc_options: mc_options_param,
      created_by_account: current_account,
      kind: profile ? 'profile' : 'community',
      locked: !profile
    )

    if question.save
      Kuestions::PublishQuestion.new(question).call unless question.profile?
      render json: question.reload, serializer: REST::Kuestions::QuestionSerializer, scope: current_account, status: 201
    else
      render json: { error: question.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  private

  # The Profile view: every profile Kuestion, Kronk's in file order first,
  # then members' newest first, each with the viewer's own answer.
  def render_profile_kuestions
    questions = Question.active.profile.includes(:created_by_account).limit(PROFILE_LIMIT).to_a
    questions.sort_by! do |question|
      question.seeded? ? [0, Kuestions::ProfileSeeds.position_of(question.seed_key)] : [1, -question.id]
    end
    render json: questions, each_serializer: REST::Kuestions::QuestionSerializer, scope: current_account, with_my_answer: true
  end

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
