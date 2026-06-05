# frozen_string_literal: true

class REST::FlowCycleSerializer < ActiveModel::Serializer
  attributes :id, :started_on, :ended_on, :cycle_length, :notes,
             :current_phase, :ovulation_day, :fertile_window_start,
             :fertile_window_end, :predicted_next_start,
             :shared_with_account_ids, :created_at, :updated_at

  belongs_to :account, serializer: REST::AccountSerializer

  attribute :is_owner, if: :current_user?

  def id
    object.id.to_s
  end

  def current_phase
    object.current_phase
  end

  def ovulation_day
    object.ovulation_day
  end

  def fertile_window_start
    object.fertile_window_start
  end

  def fertile_window_end
    object.fertile_window_end
  end

  def predicted_next_start
    object.predicted_next_start
  end

  def shared_with_account_ids
    object.flow_cycle_shares.map { |s| s.account_id.to_s }
  end

  def is_owner
    object.account_id == current_user.account.id
  end

  def current_user?
    !current_user.nil?
  end
end
