# frozen_string_literal: true

# Export the live Kommons proposal list into a readable digest + a structured
# JSON file, so contributors on the mainframe dev server can see what's on the
# board without logging into the app. Mirrors the shape of
# `kommons:attachments:export` (which materialises proposal *files*); this
# materialises the proposal *list* itself.
#
#   DEST/proposals.md    — human digest, grouped by status, backing-ranked
#   DEST/proposals.json  — structured records for tooling
#
# Fields are exactly what the proposal board shows any signed-in viewer
# (title, status, backing totals, task progress, seeder handle) — no private
# user data. A portal cron runs this on the deploy host and rsyncs the two
# files to `/home/shared/proposals.{md,json}` on the mainframe — see the infra
# runbook.
#
#   bin/rails kommons:proposals:export DEST=/tmp/kexport
#
# Idempotent: overwrites the two files each run.

namespace :kommons do
  namespace :proposals do
    desc 'Export the proposal list to DEST/proposals.{md,json} for the shared folder.'
    task export: :environment do
      dest = ENV['DEST'].presence or abort 'Pass DEST=<dir>'
      FileUtils.mkdir_p(dest)

      # Open-proposal rank denominator: total staked per open proposal, so we
      # can label "#N most-backed" the same way the serializer does.
      open_totals =
        ProposalBacking
        .where(proposal_id: Proposal.open.select(:id))
        .group(:proposal_id)
        .sum(:amount)
      rank_of = lambda do |proposal|
        total = open_totals[proposal.id].to_i
        next nil unless proposal.status == 'open' && total.positive?

        open_totals.values.count { |v| v.to_i > total } + 1
      end

      records =
        Proposal
        .includes(:created_by_account)
        .order(created_at: :desc)
        .map do |p|
          tasks = p.tasks.group(:status).count
          {
            id: p.id.to_s,
            title: p.title,
            summary: p.summary,
            status: p.status,
            type: p.proposal_type,
            node_id: p.node_id,
            seeder: p.created_by_account&.username,
            parent_proposal_id: p.parent_proposal_id&.to_s,
            categories: p.categories,
            backing: {
              total: p.backing_total,
              backers: ProposalBacking.backer_totals(p.id).size,
              rank: rank_of.call(p),
            },
            tasks: {
              open: tasks['open'].to_i,
              in_progress: tasks['in_progress'].to_i,
              done: tasks['done'].to_i,
            },
            budget_total: p.budget_items.sum(:cost_estimate).to_f,
            opens_at: p.opens_at&.iso8601,
            created_at: p.created_at.iso8601,
          }
        end

      File.write(File.join(dest, 'proposals.json'), "#{JSON.pretty_generate(records)}\n")

      # ── Human digest ──────────────────────────────────────────────────────
      order = %w(open delivered completed annulled)
      by_status = records.group_by { |r| r[:status] }
      generated = Time.now.utc.strftime('%Y-%m-%d %H:%M UTC')

      md = +"# Kommons proposals\n\n"
      md << "_Live mirror of the Kommons board — generated #{generated}. " \
            'Read-only; refreshed automatically. See `proposals.json` for the ' \
            "structured form._\n\n"
      md << "**#{records.size}** proposal(s): " <<
        order.select { |s| by_status[s] }
             .map { |s| "#{by_status[s].size} #{s}" }.join(', ') << "\n"

      order.each do |status|
        rows = by_status[status]
        next if rows.blank?

        # Within a status, strongest backing first (nil rank sinks to the end).
        rows = rows.sort_by { |r| [r.dig(:backing, :rank) || 1_000_000, -r.dig(:backing, :total).to_i] }
        md << "\n## #{status.capitalize} (#{rows.size})\n\n"
        rows.each do |r|
          b = r[:backing]
          t = r[:tasks]
          rank = b[:rank] ? " · ##{b[:rank]} most-backed" : ''
          total_steps = t[:open] + t[:in_progress] + t[:done]
          steps = total_steps.positive? ? " · steps #{t[:done]}/#{total_steps} done" : ''
          seeder = r[:seeder] ? " · @#{r[:seeder]}" : ''
          node = r[:node_id].present? ? " · `#{r[:node_id]}`" : ''
          md << "- **#{r[:title]}** (##{r[:id]}, #{r[:type]})#{seeder}#{node}\n"
          md << "  - ₭#{b[:total]} backed · #{b[:backers]} backer(s)#{rank}#{steps}\n"
          md << "  - #{r[:summary]}\n" if r[:summary].present?
        end
      end

      File.write(File.join(dest, 'proposals.md'), md)
      puts "exported #{records.size} proposal(s) to #{dest}/proposals.{md,json}"
    end

    # Korner/slug renames (groups -> krew, kompass -> map, wachuneed ->
    # martketplace) and retired nodes
    # leave some proposals pointing at a node_id that is no longer registered.
    # Any write to such a proposal (deliver!, complete!) then fails the
    # `node_id is a registered Kronk node` validation. This remaps the known
    # stale ids to their current node. Idempotent — only stale ids with a
    # registered target are touched; re-running is a no-op. Dry-run with
    # DRY_RUN=1.
    #
    #   RAILS_ENV=production bundle exec rake kommons:proposals:remap_stale_nodes
    #   RAILS_ENV=production DRY_RUN=1 bundle exec rake kommons:proposals:remap_stale_nodes
    desc 'Remap proposals whose node_id points at a renamed/removed node to its current node. DRY_RUN=1 to preview.'
    task remap_stale_nodes: :environment do
      dry_run = ENV['DRY_RUN'] == '1'
      log = ->(m) { puts "[kommons:proposals:remap_stale_nodes] #{m}" }

      remap = {
        'groups.index' => 'krew.index',
        'groups.detail' => 'krew.detail',
        'kompass.index' => 'map.index',
        'kommons.skeleton' => 'kommons.new_korner',
        'wachuneed.index' => 'martketplace.index',
      }
      registered = ->(nid) { nid.present? && !Kronk::NodeRegistry.find(nid).nil? }

      changed = 0
      unmapped = []
      Proposal.where.not(node_id: nil).find_each do |proposal|
        next if registered.call(proposal.node_id)

        target = remap[proposal.node_id]
        if target && registered.call(target)
          line = "##{proposal.id}  #{proposal.node_id} -> #{target}"
          line += ' (dry-run)' if dry_run
          log.call(line)
          proposal.update_column(:node_id, target) unless dry_run
          changed += 1
        else
          unmapped << [proposal.id, proposal.node_id]
        end
      end

      log.call("#{changed} proposal(s) #{dry_run ? 'to remap' : 'remapped'}.")

      unless unmapped.empty?
        log.call('Stale node_ids with no mapping (add them to `remap` in this task):')
        unmapped.each { |id, nid| log.call("  ##{id}  #{nid}") }
      end
    end
  end
end
