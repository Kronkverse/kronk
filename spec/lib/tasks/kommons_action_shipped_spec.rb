# frozen_string_literal: true

require 'rails_helper'
require 'rake'

RSpec.describe 'kommons:proposals:action_shipped' do # rubocop:disable RSpec/DescribeClass
  let(:alice) { Fabricate(:account, username: 'alice') }
  let!(:open_proposal) { Fabricate(:proposal, created_by_account: alice, title: 'Save images') }
  let!(:closed_proposal) { Fabricate(:proposal, created_by_account: alice, title: 'Old one', status: :closed) }
  let!(:unlisted) { Fabricate(:proposal, created_by_account: alice, title: 'Not shipped') }
  let(:list) { Tempfile.new(['shipped', '.yaml']) }

  before(:all) { Rails.application.load_tasks if Rake::Task.tasks.empty? } # rubocop:disable RSpec/BeforeAfterAll

  before do
    list.write({ '2.0.8' => [open_proposal.id.to_s, closed_proposal.id.to_s, '1'] }.to_yaml)
    list.close
    allow(Rails.root).to receive(:join).and_call_original
    allow(Rails.root).to receive(:join).with('config', 'shipped_proposals.yaml').and_return(Pathname.new(list.path))
  end

  after { list.unlink }

  def run_task(env = {})
    task = Rake::Task['kommons:proposals:action_shipped']
    task.reenable
    ClimateControl.modify(env) { expect { task.invoke }.to output(/actioned\.$/).to_stdout }
  end

  it 'marks the listed open proposals actioned and tells the proposer, leaving the rest alone' do
    allow(Kronk::ProposalStates).to receive(:notify_proposer).and_call_original

    run_task

    expect(open_proposal.reload).to be_actioned
    expect(closed_proposal.reload).to be_closed
    expect(unlisted.reload).to be_open
    expect(Kronk::ProposalStates).to have_received(:notify_proposer).with(open_proposal).once
  end

  it 'does nothing the second time' do
    run_task
    allow(Kronk::ProposalStates).to receive(:action!)

    run_task

    expect(Kronk::ProposalStates).to_not have_received(:action!)
  end

  it 'only reports under DRY_RUN' do
    run_task(DRY_RUN: '1')

    expect(open_proposal.reload).to be_open
  end
end
