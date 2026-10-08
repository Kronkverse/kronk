# frozen_string_literal: true

require 'rails_helper'
require 'rake'

RSpec.describe 'kommons:proposals:export' do # rubocop:disable RSpec/DescribeClass
  let(:dest) { Dir.mktmpdir }
  let(:alice) { Fabricate(:account, username: 'alice') }
  let(:bob) { Fabricate(:account, username: 'bob') }
  let!(:proposal) { Fabricate(:proposal, created_by_account: alice, title: 'Save images', body: "I can't save them.\nOn my phone.") }

  before(:all) { Rails.application.load_tasks if Rake::Task.tasks.empty? } # rubocop:disable RSpec/BeforeAfterAll

  after { FileUtils.remove_entry(dest) }

  def run_export
    task = Rake::Task['kommons:proposals:export']
    task.reenable
    ClimateControl.modify(DEST: dest) { expect { task.invoke }.to output(/exported/).to_stdout }
  end

  it 'writes a page per proposal with the description and the comment thread' do
    question = Fabricate(:proposal_comment, proposal: proposal, account: bob, body: 'Save inside Kronk, or to your phone?')
    Fabricate(:proposal_comment, proposal: proposal, account: alice, parent: question, body: 'To my phone')
    Fabricate(:task, proposal: proposal, title: 'Add a download button')

    run_export

    page = File.read(File.join(dest, 'proposals', "#{proposal.id}-save-images.md"))
    expect(page)
      .to include('# Save images')
      .and include("I can't save them.\nOn my phone.")
      .and include('- **@bob**')
      .and include('  - **@alice**') # the reply is nested under the question
      .and include('- [ ] Add a download button')
      .and include("/hub/kommons/p/#{proposal.id}")
  end

  it 'links each proposal from the digest and carries the details in the JSON' do
    Fabricate(:proposal_comment, proposal: proposal, account: bob, body: 'Backing this')

    run_export

    expect(File.read(File.join(dest, 'proposals.md'))).to include("[Save images](proposals/#{proposal.id}-save-images.md)")

    record = JSON.parse(File.read(File.join(dest, 'proposals.json'))).find { |r| r['id'] == proposal.id.to_s }
    expect(record).to include('body' => "I can't save them.\nOn my phone.", 'detail_file' => "proposals/#{proposal.id}-save-images.md")
    expect(record['comments']).to contain_exactly(include('author' => 'bob', 'body' => 'Backing this'))
  end
end
