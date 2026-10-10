# frozen_string_literal: true

# One JSON document of FreeTheDream's shared map — see the migration
# (CreateFreethedreamDocuments) and docs/spaces/freethedream.md.
class FreethedreamDocument < ApplicationRecord
  KINDS = %w(member map).freeze

  # The map documents the page writes. `logo-<project id>` holds an admin's
  # logo for one project. Anything else is refused rather than stored.
  MAP_KEYS = %w(approved review stewards edits).freeze
  MAP_LOGO_KEY = /\Alogo-[A-Za-z0-9_~-]{1,120}\z/

  # Logos are images resized to 512px by the page and stored inline, so the
  # caps are sized for a handful of them, not for text.
  MAX_MEMBER_BYTES = 2.megabytes
  MAX_MAP_BYTES = 1.megabyte

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
  scope :map_docs, -> { where(kind: 'map') }

  def self.map_key?(key)
    return false if RESERVED_KEYS.include?(key.delete_prefix('logo-'))

    MAP_KEYS.include?(key) || MAP_LOGO_KEY.match?(key)
  end

  # What the server guarantees about every stored document, whatever page
  # wrote it (docs/spaces/freethedream.md, "What the server enforces"):
  #
  # - no reserved key anywhere, at any depth;
  # - every `at` stamp is at most now, so nobody can date an edit into the
  #   future to outrank the admins' forever;
  # - in a member's own document: suggestion ids are the page's own base36
  #   ids, every project / link / claim id is a safe id, and suggestions
  #   carry no `tpl` (only an admin's map/approved may tie a project to one
  #   of the founding templates).
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
        drop.except('tpl')
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

  def self.clean_map(data, now_ms: (Time.now.to_f * 1000).to_i)
    clean(data, now_ms)
  end

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
