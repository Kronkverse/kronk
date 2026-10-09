# frozen_string_literal: true

require_relative 'base'

module Mastodon::CLI
  # Back-end-only proposal transitions.
  #
  # `action` and `annul` live here as the back-end paths. Annul is shell-only
  # (it moves tokens and has no in-app surface to discover, phish, or
  # mis-permission). Action is also open to the claimant in the app; the shell
  # path is for proposals nobody claimed, or a proposer building their own.
  #
  # Closing an actioned proposal is deliberately NOT here: that is the
  # proposer's call, and it happens in the app.
  class Kommons < Base
    desc 'action ID', 'Mark a proposal actioned (the work is built)'
    long_desc <<~LONG
      Moves an open or claimed proposal to `actioned` and notifies the
      proposer, who is then the only person who can close it and release the
      backed tokens.

      No tokens move at this step. Backing closes.

      Only from `open` or `claimed`. There is no way back — if a problem turns
      up afterwards, open a new proposal.

      `deliver` is the pre-rename name for this command and still works.
    LONG
    # `action` is a Thor reserved word, so the method is `mark_actioned` and
    # `action` (plus the old `deliver`) are mapped onto it.
    def mark_actioned(id)
      proposal = find_proposal(id)
      report(proposal, 'before')

      Kronk::ProposalStates.action!(proposal)

      say("Actioned. #{proposal.created_by_account.username} has been notified and can now close it.", :green)
      report(proposal.reload, 'after')
    rescue Kronk::ProposalStates::InvalidTransition => e
      say(e.message, :red)
      exit(1)
    end
    map 'action' => :mark_actioned, 'deliver' => :mark_actioned

    desc 'annul ID', 'Annul a proposal and release its backed tokens'
    long_desc <<~LONG
      Moves an open or claimed proposal to `annulled` and returns every backer their full
      stake. The author is paid nothing.

      This is the release valve: without it, a backed proposal that never
      ships would lock its backers' tokens indefinitely, because backing
      cannot be withdrawn.

      Only from `open` or `claimed`. An actioned proposal cannot be annulled.
    LONG
    def annul(id)
      proposal = find_proposal(id)
      report(proposal, 'before')

      backed = proposal.backing_total
      Kronk::ProposalStates.annul!(proposal)

      say("Annulled. #{backed} tokens returned to backers.", :green)
      report(proposal.reload, 'after')
    rescue Kronk::ProposalStates::InvalidTransition => e
      say(e.message, :red)
      exit(1)
    end

    desc 'show ID', 'Show a proposal, its state and its backing'
    def show(id)
      report(find_proposal(id), 'state')
    end

    desc 'attachments ID', 'List a proposal\'s attachments, or dump them to a directory'
    long_desc <<~LONG
      Lists the mockups, briefs and references attached to a proposal.

      This is the read path for whoever is implementing the proposal —
      including agents, which is the point. `--dump DIR` writes every
      attachment into DIR so they can be opened and read directly.
    LONG
    option :dump, type: :string, desc: 'Write attachments into this directory'
    def attachments(id)
      proposal = find_proposal(id)
      items = proposal.proposal_attachments.recent

      if items.empty?
        say("No attachments on ##{proposal.id} #{proposal.title}", :yellow)
        return
      end

      say("##{proposal.id} #{proposal.title}")
      items.each do |a|
        say("  [#{a.kind}] #{a.filename} (#{a.file_content_type}, #{a.byte_size} bytes) by @#{a.account.username}")
        say("      #{a.description}") if a.description.present?
      end

      dump_to(options[:dump], items) if options[:dump].present?
    end

    private

    def dump_to(dir, items)
      FileUtils.mkdir_p(dir)
      items.each do |a|
        dest = File.join(dir, "#{a.id}-#{a.filename}")
        a.file.copy_to_local_file(:original, dest)
        say("  wrote #{dest}", :green)
      rescue => e
        say("  failed #{a.filename}: #{e.class} #{e.message}", :red)
      end
    end

    def find_proposal(id)
      Proposal.find(id)
    rescue ActiveRecord::RecordNotFound
      say("No proposal with id #{id}", :red)
      exit(1)
    end

    def report(proposal, label)
      say("#{label}: ##{proposal.id} #{proposal.title}")
      say("  status:    #{proposal.status}")
      say("  proposer:  @#{proposal.created_by_account.username}")
      say("  claimed:   #{proposal.claimed_by_account ? "@#{proposal.claimed_by_account.username}" : '—'}")
      say("  backed:    #{proposal.backing_total} tokens from #{ProposalBacking.backer_totals(proposal.id).size} backers")
      say("  node:      #{proposal.node_id || '—'}")
    end
  end
end
