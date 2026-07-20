# frozen_string_literal: true

# Seed / refresh the Kommons build-tracker from config/kommons_tracker.yaml.
#
# Idempotent: each entry is keyed on a `tracker:<key>` category, so re-running
# updates the proposal in place and reconciles its tasks. Proposals anchor to a
# Skeleton node via `node_id`, so the Skeleton/Lattice show live build status.
#
#   bin/rails kommons:tracker:seed ACCOUNT=<username>   # create/update
#   bin/rails kommons:tracker:seed DRY=1                # report only, no writes
#
# See docs/spaces/kommons_tracker.md.

namespace :kommons do
  namespace :tracker do
    desc 'Seed/refresh Kommons build-tracker proposals (idempotent). ACCOUNT=<username> DRY=1'
    task seed: :environment do
      types = { 'small' => :small, 'medium' => :medium, 'large' => :large }
      data = YAML.safe_load_file(Rails.root.join('config', 'kommons_tracker.yaml'))
      dry = ENV['DRY'].present?

      account =
        if ENV['ACCOUNT'].present?
          Account.find_by(username: ENV['ACCOUNT'])
        else
          Account.joins(:user).order(:id).first
        end
      abort 'No account found — pass ACCOUNT=<username>' if account.nil? && !dry

      entries = Array(data['proposals']) + Array(data['decisions'])
      created = 0
      updated = 0
      task_count = 0

      entries.each do |e|
        tracker_cat = "tracker:#{e['key']}"
        categories = Array(e['categories']).dup
        categories.unshift('rebuild')
        categories << tracker_cat
        categories.uniq!
        body = e['body'].to_s.strip.presence || e['summary'].presence || e['title']
        attrs = {
          title: e['title'],
          body: body,
          summary: e['summary']&.slice(0, 500),
          node_id: e['node'],
          categories: categories,
          proposal_type: types.fetch(e['type'], :medium),
          status: :open,
        }

        existing = Proposal.where('? = ANY(categories)', tracker_cat).first
        tasks = Array(e['tasks'])

        if dry
          probe = Proposal.new(attrs.merge(created_by_account: account))
          state = account.nil? || probe.valid? ? 'ok' : probe.errors.full_messages.join('; ')
          verb = existing ? 'update' : 'create'
          puts "#{verb.ljust(7)} #{e['title'].to_s.ljust(42)} " \
               "#{e['node'].to_s.ljust(26)} #{tasks.size.to_s.rjust(2)} tasks  #{state}"
          task_count += tasks.size
          next
        end

        if existing
          existing.update!(attrs)
          proposal = existing
          updated += 1
        else
          proposal = Proposal.create!(attrs.merge(created_by_account: account))
          created += 1
        end

        tasks.each do |title|
          task = proposal.tasks.find_or_initialize_by(title: title)
          task.status = :open if task.new_record?
          task.save!
          task_count += 1
        end
      end

      if dry
        puts "\nDRY: #{entries.size} proposals, #{task_count} tasks (no writes)."
      else
        puts "Seeded: +#{created} created, #{updated} updated, #{task_count} tasks reconciled."
      end
    end
  end
end
