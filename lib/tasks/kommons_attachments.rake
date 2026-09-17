# frozen_string_literal: true

# Export every proposal's uploaded files into a readable folder tree, so
# implementers (who work on the mainframe dev server, not in a browser) can
# open them as plain files. Attachments live in object storage under
# Paperclip's hashed paths; this materialises them under human-readable names:
#
#   DEST/<proposal-id>-<title-slug>/<original-filename>
#
# Reads through the app's existing storage credentials (Paperclip
# `copy_to_local_file`), so no separate storage key is needed. A portal cron
# runs this on the deploy host and rsyncs DEST to `/home/shared/proposal-files/`
# on the mainframe — see the infra runbook.
#
#   bin/rails kommons:attachments:export DEST=/tmp/kexport
#
# Idempotent: the caller wipes DEST first (rsync --delete downstream), so this
# only writes.

namespace :kommons do
  namespace :attachments do
    desc 'Export proposal attachments into DEST/<proposal>/<filename> for the shared folder.'
    task export: :environment do
      dest = ENV['DEST'].presence or abort 'Pass DEST=<dir>'
      FileUtils.mkdir_p(dest)

      exported = 0
      failed = 0

      ProposalAttachment.includes(:proposal).find_each do |att|
        proposal = att.proposal
        next if proposal.nil?

        slug = proposal.title.to_s.parameterize.presence || 'untitled'
        dir = File.join(dest, "#{proposal.id}-#{slug}")
        FileUtils.mkdir_p(dir)

        name = att.filename.presence || "attachment-#{att.id}"
        path = File.join(dir, name)
        # Two files with the same original name on one proposal — keep both by
        # prefixing the later one with its attachment id.
        path = File.join(dir, "#{att.id}-#{name}") if File.exist?(path)

        begin
          att.file.copy_to_local_file(:original, path)
          exported += 1
        rescue => e
          failed += 1
          warn "attachment #{att.id} (proposal #{proposal.id}): #{e.class} #{e.message}"
        end
      end

      tail = failed.positive? ? ", #{failed} failed" : ''
      puts "exported #{exported} file(s) to #{dest}#{tail}"
    end
  end
end
