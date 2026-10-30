# frozen_string_literal: true

# FreeTheDream — an emergence (a top-level project, the root), one of its
# gangs, or one of a gang's fractals (docs/spaces/freethedream.md, "The
# mechanism"). Gangs sit under the emergence and fractals under a gang
# (Kitchen → Cooking, Cleaning, Storage); nothing goes deeper. Membership lives
# on the root and covers every gang in it, and the root's Krew holds the
# same people. An emergence (a projekt) lives in a Krew, which can hold
# several, and is Konnected to it, so the Krew page shows it
# (docs/spaces/freethedream.md, "The Krew").
#
# Whoever made a project or part owns it. Nobody else can change or remove
# it, but if its owner leaves (or their account goes) anyone in the project
# can take it over.
module Freethedream
  class Project < ApplicationRecord
    include Kronk::AttachmentSource
    include Kronk::NamedLink

    self.attachment_source_slug = 'freethedream'

    self.table_name = 'freethedream_projects'
    # Date and place come from the linked Kalendar event now (2026-10-13).
    self.ignored_columns += %w(starts_on location)

    TITLE_MAX = 120
    DESCRIPTION_MAX = 5000

    belongs_to :parent, class_name: 'Freethedream::Project', optional: true
    belongs_to :root, class_name: 'Freethedream::Project', optional: true
    belongs_to :owner, class_name: 'Account', optional: true
    belongs_to :source_idea, class_name: 'Freethedream::Item', optional: true
    belongs_to :cover, class_name: 'MediaAttachment', foreign_key: :cover_media_attachment_id, optional: true, inverse_of: false
    belongs_to :krew, optional: true, inverse_of: :freethedream_projects

    has_many :children, class_name: 'Freethedream::Project', foreign_key: :parent_id, inverse_of: :parent, dependent: nil
    has_many :memberships, class_name: 'Freethedream::Membership', dependent: nil
    has_many :placements, class_name: 'Freethedream::Placement', dependent: nil
    has_many :items, through: :placements
    has_many :dependencies, class_name: 'Freethedream::Dependency', dependent: nil
    has_many :depends_on, through: :dependencies, source: :depends_on
    has_many :dependent_links, class_name: 'Freethedream::Dependency', foreign_key: :depends_on_id, inverse_of: :depends_on, dependent: nil
    has_many :needed_by, through: :dependent_links, source: :project
    has_many :comments, class_name: 'Freethedream::Comment', as: :subject, dependent: :delete_all
    has_many :activities, class_name: 'Freethedream::Activity', dependent: nil

    enum :joining, { open: 0, by_request: 1 }, suffix: :joining, validate: true

    validates :title, presence: true, length: { maximum: TITLE_MAX }
    validates :description, length: { maximum: DESCRIPTION_MAX }
    validate :parent_is_fixed, on: :update
    validate :gangs_and_fractals_only, on: :create

    before_validation :set_root, on: :create
    after_create :join_owner!, if: :top?
    after_create :join_krew_members!, if: -> { top? && krew_id.present? }

    scope :top_level, -> { where(parent_id: nil) }
    scope :recent, -> { order(created_at: :desc) }

    # What the Konnect picker offers when it searches: projekts, not the
    # gangs and fractals inside them (Tal, 2026-10-30). A gang already
    # Konnected still opens by its id.
    def self.attachment_candidates
      top_level
    end

    def top?
      parent_id.nil?
    end

    def top
      top? ? self : root
    end

    def top_id
      root_id || id
    end

    # Right under the emergence (Kitchen).
    def gang?
      !top? && parent_id == root_id
    end

    # A piece of a gang (Kitchen › Cooking).
    def fractal?
      !top? && parent_id != root_id
    end

    def done?
      done_at.present?
    end

    # Any signed-in person can open a project and see what it's about; only
    # members take part. KornerAttachmentPolicy reads this, so a Kalendar
    # event linked to a project shows on both sides.
    #
    # Who sees a projekt follows its Krew (Tal, 2026-10-30): anyone signed
    # in when the Krew is listed (open, asking to join, or with
    # requirements), only its members when it's invite only.
    def visible_to?(account)
      return false if account.nil?

      krew = top.krew
      krew.nil? || krew.listed? || krew.member?(account)
    end

    # How someone outside gets in: the Krew's way in. `open` joins with a
    # tap, `by_request` asks the Krew, and `krew` means through the Krew
    # page (an invite, or its requirements).
    def joining_via_krew
      case top.krew&.access
      when nil, 'open' then 'open'
      when 'approval' then 'by_request'
      else 'krew'
      end
    end

    # The Kalendar event an in-person project or gang happens at, and the
    # link to it: [event, attachment], or nil. The link is a korner
    # attachment between the event and the project. Anyone can link
    # their own event to any project, so only an event made by someone in
    # the emergence counts; the newest such link wins.
    def event_link
      found = event_links([id]).first
      found&.first(2)
    end

    # Every Kalendar event linked to one of `ids` (this projekt's parts),
    # newest link first, as [event, link, part id]. Made from either end:
    # the event's Attach or the projekt's. Only live events made by someone
    # in the projekt count.
    def event_links(ids)
      ids = ids.map(&:to_i)
      links = KornerAttachment.where(kind: KornerAttachment::KIND_LINK)
      links = links.where(source_slug: 'kalendar', target_slug: 'freethedream', target_id: ids)
                   .or(links.where(source_slug: 'freethedream', source_id: ids, target_slug: 'kalendar'))
                   .order(created_at: :desc).to_a
      event_id = ->(link) { Kronk::AttachmentEffects.ends(link, 'kalendar').first }
      events = Event.where(id: links.map(&event_id)).index_by(&:id)
      members = Membership.member.where(project_id: top_id).pluck(:account_id)

      links.filter_map do |link|
        event = events[event_id.call(link)]
        next unless event && !event.cancelled? && members.include?(event.account_id)

        [event, link, link.source_slug == 'freethedream' ? link.source_id.to_i : link.target_id.to_i]
      end
    end

    def member?(account)
      return false if account.nil?

      Membership.member.exists?(project_id: top_id, account_id: account.id)
    end

    # Owned by someone, and that someone is still in the project.
    def owned_by?(account)
      account.present? && owner_id == account.id
    end

    # Its owner has gone (left, or their account was deleted).
    def up_for_grabs?
      owner_id.nil? || !member?(owner)
    end

    # Join someone in straight away (a Krew they joined, or an accepted
    # request). Membership#join_krew keeps the Krew in step.
    def add_member!(account)
      membership = Membership.find_or_initialize_by(project_id: top_id, account_id: account.id)
      membership.update!(state: :member) unless membership.persisted? && membership.member?
    end

    # Ask to join a by-request emergence. There is one list of requests,
    # the Krew's, whichever page someone asks from, and anyone in can
    # answer it (Tal, 2026-10-19: err syntropic). Everyone in hears.
    def ask_to_join!(account)
      krew = top.ensure_krew!
      return if krew.nil? || member?(account)

      request = krew.krew_join_requests.find_or_initialize_by(account: account)
      return unless request.new_record?

      request.save!
      Kronk::KrewJoinRequests.notify_requested(krew, account)
    end

    # Who's asking to join, oldest first (the Krew's requests).
    def join_requests
      return KrewJoinRequest.none unless top.krew

      top.krew.krew_join_requests.oldest_first.joins(:account).merge(Account.without_suspended).preload(:account)
    end

    def asked_to_join?(account)
      top.krew.present? && top.krew.krew_join_requests.exists?(account_id: account.id)
    end

    # Leave, or withdraw a request. What they made stays, up for grabs;
    # what they were on and what they offered from their Mycelium go with
    # them (what they said they'd bring against a need stays).
    def remove_member!(account)
      Membership.where(project_id: top_id, account_id: account.id).destroy_all
      KrewJoinRequest.where(krew_id: top.krew_id, account_id: account.id).delete_all if top.krew_id
      Item.offer_kind.where(root_id: top_id, owner_id: account.id, need_id: nil).where.not(mycelium_item_id: nil).find_each(&:destroy!)
      Claim.where(account_id: account.id, item_id: Item.where(root_id: top_id).select(:id)).delete_all
    end

    # The emergence's Krew, made the first time it's asked for (an emergence
    # from before Krews held them), Konnected to it like any other, with
    # everyone already in the emergence as its members and the owner as its
    # seeder. It takes the emergence's name and way in: open, or asking to
    # join (Krew "approval").
    def ensure_krew!
      return nil unless top?
      return krew if krew

      transaction do
        made = Krew.create!(
          name: title,
          slug: krew_slug,
          description: description.truncate(500),
          access: krew_access,
          invite_token: krew_access == 'open' ? nil : SecureRandom.urlsafe_base64(Krew::INVITE_TOKEN_BYTES),
          seeded_by: owner,
          last_activity_at: Time.current
        )
        update_column(:krew_id, made.id)
        self.krew = made
        Membership.member.where(project_id: id).find_each do |membership|
          made.krew_memberships.create!(account_id: membership.account_id, role: membership.account_id == owner_id ? 'seeder' : 'member', source: 'direct')
        end
        Kronk::AttachmentEffects.link!('freethedream', id, 'krew', made.id, owner) if owner
      end
      krew
    end

    # Top-down, starting from the root: [Mini Doof, Live Stage].
    def ancestors
      chain = []
      node = parent
      while node
        chain.unshift(node)
        node = node.parent
      end
      chain
    end

    # Every part under this one, at any depth.
    def descendants
      parts = Project.where(root_id: top_id).to_a
      by_parent = parts.group_by(&:parent_id)
      found = []
      queue = [id]
      until queue.empty?
        kids = by_parent[queue.shift] || []
        found.concat(kids)
        queue.concat(kids.map(&:id))
      end
      found
    end

    # Parts or items under here that belong to someone else. A project can
    # only be removed by its owner, and only when nobody else has anything
    # in it: removing it must not take anyone else's work with it.
    def holds_others_work?(account)
      subtree_ids = [id] + descendants.map(&:id)
      others = ->(relation) { relation.where.not(owner_id: account.id).or(relation.where(owner_id: nil)) }

      others.call(Project.where(id: subtree_ids)).exists? ||
        others.call(Item.where(id: item_ids_within(subtree_ids))).exists?
    end

    # Remove this part and everything in it. Items that are also placed
    # somewhere outside it stay there. The parts inside go through Rails,
    # deepest first, rather than the database's parent_id cascade, so each
    # one's links (a gang's Kalendar event) go with it
    # (Kronk::AttachmentSource#cleanup_kronk_attachments).
    def remove!
      parts = descendants
      subtree_ids = [id] + parts.map(&:id)
      gone = item_ids_within(subtree_ids)
      gone -= Placement.where(item_id: gone).where.not(project_id: subtree_ids).pluck(:item_id) unless top?

      transaction do
        Comment.where(subject_type: Item.name, subject_id: gone).delete_all
        Comment.where(subject_type: Project.name, subject_id: subtree_ids).delete_all
        Item.where(id: gone).delete_all
        parts.reverse_each(&:destroy!)
        destroy!
      end
    end

    private

    def set_root
      self.root_id = parent && (parent.root_id || parent.id)
    end

    def item_ids_within(project_ids)
      return Item.where(root_id: id).pluck(:id) if top?

      Placement.where(project_id: project_ids).distinct.pluck(:item_id)
    end

    def join_owner!
      memberships.create!(account_id: owner_id, state: :member) if owner_id
    end

    # A new projekt has everyone in its Krew, and is Konnected to it so the
    # Krew page shows it.
    def join_krew_members!
      krew.krew_memberships.where.not(account_id: owner_id).pluck(:account_id).each do |account_id|
        memberships.find_or_create_by!(account_id: account_id) { |m| m.state = :member }
      end
      Kronk::AttachmentEffects.link!('freethedream', id, 'krew', krew_id, owner || krew.seeded_by)
    end

    def parent_is_fixed
      errors.add(:parent_id, :invalid) if parent_id_changed?
    end

    # An emergence holds gangs, and a gang holds fractals, the pieces of
    # the pie that make it up (Tal, 2026-10-15). A fractal holds nothing.
    def gangs_and_fractals_only
      errors.add(:parent_id, :invalid) if parent&.fractal?
    end

    def krew_access
      open_joining? ? 'open' : 'approval'
    end

    # "mini-doof-12": readable, starting with a letter, unique by the id
    # (and a random tail in the unlikely case that's taken).
    def krew_slug
      base = title.parameterize.tr('_', '-').first(40).delete_suffix('-')
      base = "emergence-#{base}".delete_suffix('-') unless base.match?(/\A[a-z]/)
      slug = "#{base}-#{id}"
      Krew.exists?(slug: slug) ? "#{slug}-#{SecureRandom.hex(3)}" : slug
    end
  end
end
