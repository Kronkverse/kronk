# frozen_string_literal: true

# One person's document on FreeTheDream's open map (docs/spaces/freethedream.md).
# Everything a person writes lives in their own, replaced whole on save:
#
#   drops   — projects they added: [{ id, name, what, …, open, runners, dismissed }]
#             `open` true means anyone can join in running it; false, the
#             creator accepts helpers (`runners`) and can turn requests down
#             (`dismissed`).
#   claims  — keys of projects they run or have asked to help run
#   edits   — their edits to projects, counted only where they run it
#   logos   — likewise, for project logos
#   follows — keys of projects they follow
#
# A project's key is "<creator account id>~<drop id>".
class FreethedreamDocument < ApplicationRecord
  KINDS = %w(member).freeze

  # Logos are images resized to 512px by the page and stored inline, so the
  # cap is sized for a handful of them, not for text.
  MAX_MEMBER_BYTES = 2.megabytes
  MAX_ACCOUNT_IDS = 200
  # Fields that only count from someone who runs the project they're about.
  RUNNER_FIELDS = %w(edits logos).freeze

  # Keys the page looks up in plain JS objects: as ids they match inherited
  # properties and crash the map for everyone, or set an object's prototype.
  RESERVED_KEYS = %w(__proto__ constructor prototype).freeze
  # Project, link and claim ids. No quotes (the page builds selectors from
  # them), no `|` (it joins and splits pairs on it).
  SAFE_ID = /\A[A-Za-z0-9_~-]{1,120}\z/
  # Ids the page generates for a member's own suggestions (base36).
  DROP_ID = /\A[a-z0-9]{1,40}\z/
  # Clock skew allowed on client `at` stamps before they're pulled back to now.
  AT_SLACK_MS = 60_000

  Invalid = Class.new(StandardError)

  belongs_to :updated_by_account, class_name: 'Account', optional: true

  validates :kind, inclusion: { in: KINDS }
  validates :key, presence: true, length: { maximum: 200 }
  validate :data_is_an_object

  scope :members, -> { where(kind: 'member') }

  # What the server guarantees about every stored document, whatever page
  # wrote it (docs/spaces/freethedream.md, "What the server enforces"):
  #
  # - no reserved key anywhere, at any depth;
  # - every `at` stamp is at most now, so nobody can date an edit into the
  #   future to outrank the admins' forever;
  # - in a member's own document: suggestion ids are the page's own base36
  #   ids, every project / link / claim id is a safe id, and suggestions
  #   carry no `tpl` (the open map has no founding templates to borrow);
  # - a project's `open` is a boolean, and its `runners` / `dismissed` are
  #   lists of account ids.
  #
  # Raises Invalid for anything it can't store; returns the cleaned document.
  def self.clean_member(data, now_ms: (Time.now.to_f * 1000).to_i)
    data = clean(data, now_ms)
    drops = data['drops']
    if drops.is_a?(Array)
      data['drops'] = drops.map do |drop|
        raise Invalid, 'suggestion must be an object' unless drop.is_a?(Hash)
        raise Invalid, 'bad suggestion id' unless DROP_ID.match?(drop['id'].to_s)

        check_ids!(drop['links'])
        drop.except('tpl').merge(
          'open' => drop['open'] == true,
          'runners' => account_ids(drop['runners']),
          'dismissed' => account_ids(drop['dismissed'])
        )
      end
    end
    check_ids!(data['claims'])
    %w(edits logos).each do |field|
      next unless data[field].is_a?(Hash)

      check_ids!(data[field].keys)
      data[field].each_value { |entry| check_ids!(entry['links']) if entry.is_a?(Hash) }
    end
    data
  end

  # What `viewer` (an account id string) may see of everyone's documents.
  # Requests to help run a project are between the person asking and the
  # project's creator, unless the project is open, where asking is joining
  # and everyone can see who runs it. Edits and logos only count from people
  # who run the project, so the rest aren't sent. Who a creator turned down
  # stays with the creator.
  def self.view_for(docs, viewer)
    projects = {}
    docs.each do |uid, doc|
      Array(doc['drops']).each do |drop|
        next unless drop.is_a?(Hash)

        projects["#{uid}~#{drop['id']}"] = { creator: uid, open: drop['open'] == true, runners: Array(drop['runners']).map(&:to_s) }
      end
    end

    runs = lambda do |uid, key|
      project = projects[key]
      next false unless project
      next true if project[:creator] == uid || project[:runners].include?(uid)

      project[:open] && Array(docs.dig(uid, 'claims')).include?(key)
    end

    docs.to_h do |uid, doc|
      view = doc.slice('drops', 'follows')
      view['drops'] = Array(doc['drops']).map { |d| d.is_a?(Hash) && uid != viewer ? d.except('dismissed') : d }
      view['claims'] = Array(doc['claims']).select do |key|
        project = projects[key]
        uid == viewer || (project && (project[:open] || project[:creator] == viewer))
      end
      RUNNER_FIELDS.each do |field|
        next unless doc[field].is_a?(Hash)

        view[field] = doc[field].select { |key, _| runs.call(uid, key) }
      end
      [uid, view]
    end
  end

  def self.account_ids(list)
    Array(list).map(&:to_s).grep(/\A\d{1,20}\z/).uniq.first(MAX_ACCOUNT_IDS)
  end
  private_class_method :account_ids

  def self.clean(value, now_ms)
    case value
    when Hash
      value.to_h do |k, v|
        raise Invalid, "reserved key #{k}" if RESERVED_KEYS.include?(k.to_s)

        v = [v, now_ms].min if k.to_s == 'at' && v.is_a?(Numeric) && v > now_ms + AT_SLACK_MS
        [k.to_s, clean(v, now_ms)]
      end
    when Array then value.map { |v| clean(v, now_ms) }
    else value
    end
  end
  private_class_method :clean

  def self.check_ids!(ids)
    return if ids.nil?
    raise Invalid, 'ids must be a list' unless ids.is_a?(Array)

    ids.each do |id|
      raise Invalid, "bad id #{id.to_s.first(40)}" unless SAFE_ID.match?(id.to_s) && RESERVED_KEYS.exclude?(id.to_s)
    end
  end
  private_class_method :check_ids!

  private

  def data_is_an_object
    errors.add(:data, 'must be a JSON object') unless data.is_a?(Hash)
  end
end
