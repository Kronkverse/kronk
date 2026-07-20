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
      notify_assignee_if_changed
      render json: @task, serializer: REST::TaskSerializer, status: 201
    else
      render json: { error: @task.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def update
    if @task.update(task_params)
      notify_assignee_if_changed
      render json: @task, serializer: REST::TaskSerializer
    else
      render json: { error: @task.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  private

  # Notify the assignee when a task is newly assigned or re-assigned to them.
  # Only fires when assigned_to_account_id actually changed in the last save,
  # so an unrelated update (title, status) doesn't re-notify. Self-assignment
  # is skipped by KornerNotifier's self-notify guard.
  def notify_assignee_if_changed
    return unless @task.saved_change_to_assigned_to_account_id?
    return if @task.assigned_to_account_id.blank?

    Kronk::KornerNotifier.notify(
      recipient_id: @task.assigned_to_account_id,
      from_account: current_account,
      activity: @task,
      type: 'task_assigned'
    )
  end

  def set_proposal
    @proposal = Proposal.find(params[:proposal_id])
  end

  def set_task
    @task = Task.find(params[:id])
  end

  def task_params
    params.expect(task: [:title, :description, :status, :skill_tag,
                         :effort_estimate, :assigned_to_account_id])
  end
end
