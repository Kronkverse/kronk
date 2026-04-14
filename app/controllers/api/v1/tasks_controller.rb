# frozen_string_literal: true

class Api::V1::TasksController < Api::BaseController
  before_action :require_user!
  before_action :set_proposal, only: [:index, :create]
  before_action :set_task,     only: [:update]

  def index
    @tasks = @proposal.tasks.order(created_at: :asc)
    render json: @tasks, each_serializer: REST::TaskSerializer
  end

  def create
    @task = @proposal.tasks.new(task_params)
    if @task.save
      render json: @task, serializer: REST::TaskSerializer, status: :created
    else
      render json: { error: @task.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def update
    if @task.update(task_params)
      render json: @task, serializer: REST::TaskSerializer
    else
      render json: { error: @task.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  private

  def set_proposal
    @proposal = Proposal.find(params[:proposal_id])
  end

  def set_task
    @task = Task.find(params[:id])
  end

  def task_params
    params.require(:task).permit(:title, :description, :status, :skill_tag,
                                 :effort_estimate, :assigned_to_account_id)
  end
end
