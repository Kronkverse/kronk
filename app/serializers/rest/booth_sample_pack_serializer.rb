# frozen_string_literal: true

# A sample pack (docs/spaces/booth.md, Samples): its title, cover and maker,
# how many samples it holds and of which types, and on its own page
# (`detail`) the samples themselves.
class REST::BoothSamplePackSerializer < ActiveModel::Serializer
  attributes :id, :title, :description, :cover_url, :created_at,
             :sample_count, :sample_types, :is_owner

  belongs_to :account, serializer: REST::AccountSerializer

  attribute :samples, if: -> { instance_options[:detail] == true }

  def id
    object.id.to_s
  end

  def cover_url
    object.cover_url
  end

  def sample_count
    object.samples.size
  end

  def sample_types
    object.samples.map(&:sample_type).uniq
  end

  # rubocop:disable Naming/PredicatePrefix -- `is_owner` is the JSON key, as on sets
  def is_owner
    object.account_id == current_user&.account_id
  end
  # rubocop:enable Naming/PredicatePrefix

  def samples
    list = object.samples.includes(:account, :audio_attachment, :pack)
    granted = current_user ? BoothSampleRequest.where(account_id: current_user.account_id, state: 'yes', booth_sample_id: list.map(&:id)).pluck(:booth_sample_id).to_set : Set.new
    list.map { |sample| REST::BoothSampleSerializer.new(sample, scope: current_user, scope_name: :current_user, granted_ids: granted).as_json }
  end
end
