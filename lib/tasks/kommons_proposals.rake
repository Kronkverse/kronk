# frozen_string_literal: true

# Export the live Kommons proposal list into a readable digest + a structured
# JSON file, so contributors on the mainframe dev server can see what's on the
# board without logging into the app. Mirrors the shape of
# `kommons:attachments:export` (which materialises proposal *files*); this
# materialises the proposal *list* itself.
#
#   DEST/proposals.md    — human digest, grouped by status, backing-ranked
#   DEST/proposals.json  — structured records for tooling
#   DEST/proposals/<id>-<slug>.md — one page per proposal: the description,
#                          tasks, attachments and the comment thread, i.e. what
#                          a dev needs to pick it up without opening the app
#
# Fields are exactly what the proposal page shows any signed-in viewer
# (title, description, status, backing totals, tasks, comments, seeder
# handle) — no private user data. A portal cron runs this on the deploy host
# and copies the output to `/home/shared/` on the mainframe — see the infra
# runbook. Attachment paths in the per-proposal pages point at the sibling
# `proposal-files/` mirror made by `kommons:attachments:export`.
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

      # Active-proposal rank denominator: total staked per open/claimed proposal, so we
      # can label "#N most-backed" the same way the serializer does.
      open_totals =
        ProposalBacking
        .where(proposal_id: Proposal.active.select(:id))
        .group(:proposal_id)
        .sum(:amount)
      rank_of = lambda do |proposal|
        total = open_totals[proposal.id].to_i
        next nil unless Proposal::ACTIVE_STATES.include?(proposal.status) && total.positive?

        open_totals.values.count { |v| v.to_i > total } + 1
      end

      host = "#{Rails.configuration.x.use_https ? 'https' : 'http'}://#{Rails.configuration.x.web_domain}"
      slug_of = ->(p) { "#{p.id}-#{p.title.to_s.parameterize.presence || 'untitled'}" }

      # Same names `kommons:attachments:export` writes: a repeated original
      # filename on one proposal gets its attachment id as a prefix.
      attachment_paths = lambda do |p|
        seen = Set.new
        p.proposal_attachments.order(:id).map do |att|
          name = att.filename.presence || "attachment-#{att.id}"
          name = "#{att.id}-#{name}" unless seen.add?(name)
          "proposal-files/#{slug_of.call(p)}/#{name}"
        end
      end

      records =
        Proposal
        .includes(:created_by_account, :claimed_by_account, proposal_comments: :account, tasks: :assigned_to_account)
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
            claimed_by: p.claimed_by_account&.username,
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
            url: "#{host}/hub/kommons/p/#{p.id}",
            detail_file: "proposals/#{slug_of.call(p)}.md",
            body: p.body,
            outcome_notes: p.outcome_notes.presence,
            task_items: p.tasks.sort_by(&:id).map do |t|
              {
                title: t.title,
                description: t.description.presence,
                status: t.status,
                assignee: t.assigned_to_account&.username,
              }
            end,
            attachments: attachment_paths.call(p),
            comments: p.proposal_comments.sort_by(&:created_at).map do |c|
              {
                id: c.id.to_s,
                parent_id: c.parent_id&.to_s,
                author: c.account&.username,
                body: c.body,
                created_at: c.created_at.iso8601,
              }
            end,
          }
        end

      File.write(File.join(dest, 'proposals.json'), "#{JSON.pretty_generate(records)}\n")

      # ── Human digest ──────────────────────────────────────────────────────
      order = %w(open claimed actioned closed annulled)
      by_status = records.group_by { |r| r[:status] }
      generated = Time.now.utc.strftime('%Y-%m-%d %H:%M UTC')

      md = +"# Kommons proposals\n\n"
      md << "_Live mirror of the Kommons board — generated #{generated}. " \
            'Read-only; refreshed automatically. Each title links to its full ' \
            'page (description, tasks, attachments, comments) in `proposals/`; ' \
            "`proposals.json` has the same records structured._\n\n"
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
          claimant = r[:claimed_by] ? " · claimed by @#{r[:claimed_by]}" : ''
          comments = r[:comments].any? ? " · #{r[:comments].size} comment(s)" : ''
          md << "- **[#{r[:title]}](#{r[:detail_file]})** (##{r[:id]}, #{r[:type]})#{seeder}#{node}#{claimant}#{comments}\n"
          md << "  - ₭#{b[:total]} backed · #{b[:backers]} backer(s)#{rank}#{steps}\n"
          md << "  - #{r[:summary]}\n" if r[:summary].present?
        end
      end

      File.write(File.join(dest, 'proposals.md'), md)

      # ── One page per proposal ─────────────────────────────────────────────
      FileUtils.mkdir_p(File.join(dest, 'proposals'))
      indent = ->(text, pad) { text.to_s.strip.gsub(/\r\n?/, "\n").gsub("\n", "\n#{pad}") }

      records.each do |r|
        page = "# #{r[:title]}\n\n"
        page << "- **Status:** #{r[:status]} · **Type:** #{r[:type]}\n"
        page << "- **Proposed by:** @#{r[:seeder]} on #{r[:created_at][0, 10]}\n" if r[:seeder]
        page << "- **Claimed by:** @#{r[:claimed_by]}\n" if r[:claimed_by]
        page << "- **Space:** `#{r[:node_id]}`\n" if r[:node_id].present?
        page << "- **Categories:** #{r[:categories].join(', ')}\n" if r[:categories].present?
        page << "- **Backing:** ₭#{r.dig(:backing, :total)} from #{r.dig(:backing, :backers)} backer(s)\n"
        page << "- **In the app:** #{r[:url]}\n"

        page << "\n## Description\n\n#{r[:body].to_s.strip.presence || '_(none)_'}\n"
        page << "\n## Outcome notes\n\n#{r[:outcome_notes].strip}\n" if r[:outcome_notes]

        if r[:task_items].any?
          page << "\n## Tasks\n\n"
          r[:task_items].each do |t|
            box = t[:status] == 'done' ? 'x' : ' '
            who = t[:assignee] ? " · @#{t[:assignee]}" : ''
            page << "- [#{box}] #{t[:title]} (#{t[:status]}#{who})\n"
            page << "  #{indent.call(t[:description], '  ')}\n" if t[:description]
          end
        end

        if r[:attachments].any?
          page << "\n## Attachments\n\nIn `/home/shared/` on the mainframe:\n\n"
          r[:attachments].each { |path| page << "- `#{path}`\n" }
        end

        page << "\n## Comments (#{r[:comments].size})\n\n"
        if r[:comments].empty?
          page << "_No comments yet._\n"
        else
          children = r[:comments].group_by { |c| c[:parent_id] }
          ids = r[:comments].to_set { |c| c[:id] }
          write_thread = lambda do |comment, depth|
            pad = '  ' * depth
            page << "#{pad}- **@#{comment[:author]}** · #{comment[:created_at][0, 16].tr('T', ' ')}: " \
                    "#{indent.call(comment[:body], "#{pad}  ")}\n"
            (children[comment[:id]] || []).each { |reply| write_thread.call(reply, depth + 1) }
          end
          # Top level is anything without a parent, or whose parent is gone.
          r[:comments].reject { |c| c[:parent_id] && ids.include?(c[:parent_id]) }.each { |c| write_thread.call(c, 0) }
        end

        File.write(File.join(dest, r[:detail_file]), page)
      end

      puts "exported #{records.size} proposal(s) to #{dest}/proposals.{md,json} and #{dest}/proposals/"
    end

    # Korner/slug renames (groups -> krew, kompass -> map, mARTketplace/
    # martketplace -> wachuneed 2026-09-07 flip-back) and retired nodes
    # leave some proposals pointing at a node_id that is no longer registered.
    # Any write to such a proposal (action!, close!) then fails the
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
        'martketplace.index' => 'wachuneed.index',
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
