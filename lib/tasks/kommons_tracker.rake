# frozen_string_literal: true

# Seed / refresh the Kommons build-tracker from config/kommons_tracker.yaml.
#
# Idempotent: proposals are keyed on their title. All theme + decision proposals
# hang off one root proposal ("Kronk rebuild — build tracker") via
# parent_proposal, so the board is `root.child_proposals`; each anchors to a
# Skeleton node via node_id, so the Skeleton/Lattice show live build status.
# The `categories` column is a validated legacy taxonomy (being retired), so
# tracker tags live in the body as a "Tracker:" line, not in that column.
#
#   bin/rails kommons:tracker:seed ACCOUNT=<username>   # create/update
#   bin/rails kommons:tracker:seed DRY=1 ACCOUNT=<u>    # validate, no writes
#
# See docs/spaces/kommons_tracker.md.

namespace :kommons do
  namespace :tracker do
    desc 'Seed/refresh Kommons build-tracker proposals (idempotent). ACCOUNT=<username> DRY=1'
    task seed: :environment do
      root_title = 'Kronk rebuild — build tracker'
      types = { 'small' => :small, 'medium' => :medium, 'large' => :large }
      data = YAML.safe_load_file(Rails.root.join('config', 'kommons_tracker.yaml'))
      dry = ENV['DRY'].present?
      account =
        if ENV['ACCOUNT'].present?
          Account.find_by(username: ENV['ACCOUNT'])
        else
          Account.joins(:user).order(:id).first
        end
      abort 'No account found — pass ACCOUNT=<username>' if account.nil?

      root = Proposal.find_or_initialize_by(title: root_title)
      root.assign_attributes(
        body: 'Live board of the 2.0 rebuild backlog. Each child is a theme; ' \
              "a theme's steps are its tasks. See docs/spaces/kommons_tracker.md.",
        summary: 'The rebuild backlog, tracked as Kommons proposals.',
        node_id: 'kronk.how_it_works',
        proposal_type: :large,
        status: :open
      )
      root.created_by_account ||= account
      root.save! unless dry

      entries = Array(data['proposals']) + Array(data['decisions'])
      created = 0
      updated = 0
      task_count = 0

      entries.each do |e|
        tags = Array(e['categories']).dup
        tags.unshift('rebuild')
        tags.uniq!
        base = e['body'].to_s.strip.presence || e['summary'] || e['title']
        proposal = Proposal.find_or_initialize_by(title: e['title'])
        new_record = proposal.new_record?
        proposal.assign_attributes(
          body: "#{base}\n\n_Tracker: #{tags.join(' · ')}._",
          summary: e['summary']&.slice(0, 500),
          node_id: e['node'],
          proposal_type: types.fetch(e['type'], :medium),
          status: :open,
          parent_proposal: (dry ? nil : root)
        )
        proposal.created_by_account ||= account
        tasks = Array(e['tasks'])

        if dry
          state = proposal.valid? ? 'ok' : proposal.errors.full_messages.join('; ')
          puts "#{(new_record ? 'create' : 'update').ljust(7)} " \
               "#{e['title'].to_s.ljust(42)} #{e['node'].to_s.ljust(26)} " \
               "#{tasks.size.to_s.rjust(2)} tasks  #{state}"
          task_count += tasks.size
          next
        end

        proposal.save!
        new_record ? (created += 1) : (updated += 1)
        tasks.each do |title|
          task = proposal.tasks.find_or_initialize_by(title: title)
          task.status = :open if task.new_record?
          task.save!
          task_count += 1
        end
      end

      if dry
        puts "\nDRY: #{entries.size + 1} proposals, #{task_count} tasks (no writes)."
      else
        puts "Seeded: +#{created} created, #{updated} updated, " \
             "#{task_count} tasks, under '#{root_title}'."
      end
    end
  end
end
