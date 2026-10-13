# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Scheduler::BirthdayScheduler do
  let(:celebrant) { Fabricate(:account) }
  let(:mate)      { Fabricate(:account) }

  before do
    Kuestions::ProfileSeeds.sync!
    celebrant.follow!(mate)
    mate.follow!(celebrant)
    allow(LocalNotificationWorker).to receive(:perform_async)
  end

  def birthday!(scope:)
    question = Question.find_by!(seed_key: 'birthday')
    body = Time.now.utc.to_date.change(year: 1992).iso8601
    Answer.create!(question: question, account: celebrant, body: body, visibility_scope: scope).pin!
  end

  it 'nudges mates on the day' do
    birthday!(scope: 'mates')

    described_class.new.perform

    expect(LocalNotificationWorker).to have_received(:perform_async).with(mate.id, celebrant.id, 'Account', 'birthday')
  end

  it 'nudges nobody the birthday is kept from' do
    birthday!(scope: 'self_only')

    described_class.new.perform

    expect(LocalNotificationWorker).to_not have_received(:perform_async)
  end
end
