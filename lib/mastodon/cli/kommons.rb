# frozen_string_literal: true

require_relative 'base'

module Mastodon::CLI
  # Back-end-only proposal transitions.
  #
  # `deliver` and `annul` live here rather than in the API on purpose. Both
  # move tokens or close off a proposal, and both are dev actions rather than
  # community ones. Keeping them in tootctl means access is governed by who
  # can get a shell on the server — there is no in-app surface to discover,
  # phish, or mis-permission.
  #
  # Completing a delivered proposal is deliberately NOT here: that is the
  # proposer's call, and it happens in the app.
  class Kommons < Base
    desc 'deliver ID', 'Mark a proposal delivered (dev signoff)'
    long_desc <<~LONG
      Moves an open proposal to `delivered` and notifies the proposer, who is
      then the only person who can complete it and release the backed tokens.

      No tokens move at this step. Backing closes.

      A proposal can only be delivered from `open`. There is no way back —
      if a problem turns up after delivery, open a new proposal.
    LONG
    def deliver(id)
      proposal = find_proposal(id)
      report(proposal, 'before')

      Kronk::ProposalStates.deliver!(proposal)

      say("Delivered. #{proposal.created_by_account.username} has been notified and can now complete it.", :green)
      report(proposal.reload, 'after')
    rescue Kronk::ProposalStates::InvalidTransition => e
      say(e.message, :red)
      exit(1)
    end

    desc 'annul ID', 'Annul a proposal and release its backed tokens'
    long_desc <<~LONG
      Moves an open proposal to `annulled` and returns every backer their full
      stake. The author is paid nothing.

      This is the release valve: without it, a backed proposal that never
      ships would lock its backers' tokens indefinitely, because backing
      cannot be withdrawn.

      Only from `open`. A delivered proposal cannot be annulled.
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
      rescue StandardError => e
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
      say("  backed:    #{proposal.backing_total} tokens from #{ProposalBacking.backer_totals(proposal.id).size} backers")
      say("  node:      #{proposal.node_id || '—'}")
    end
  end
end
