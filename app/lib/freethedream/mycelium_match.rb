# frozen_string_literal: true

# Where what people have meets what an emergence needs
# (docs/spaces/freethedream.md, Mycelium). One rule, used three ways:
#
#   * sharing something suggests the needs and Actualise items it could
#     cover (`for_mycelium_item`);
#   * a need or Actualise item lists your Mycelium items that could cover
#     it (`mine_for`);
#   * a new need or Actualise item nudges whoever has shared something that
#     could cover it there (`nudge_for`), and only them.
#
# A match is the same category and at least one word in common, singular
# or plural ("generators" meets "Generator"). Same category alone ranks
# below, for suggestions you choose from; a nudge needs a word in common.
module Freethedream
  module MyceliumMatch
    STOP = %w(a an and the of for to with in on at some any my our your x).to_set

    module_function

    def words(title)
      title.to_s.downcase.scan(/[[:alpha:]]+/).filter_map do |word|
        next if word.length < 2 || STOP.include?(word)

        word.singularize
      end.to_set
    end

    def overlap(one, other)
      (words(one) & words(other)).size
    end

    # Needs not yet sorted, and Actualise items (open-ended: more hands are
    # welcome), in the emergence this could cover, closest first.
    def for_mycelium_item(mycelium_item, emergence)
      candidates = Item.where(root_id: emergence.id, kind: [:need, :job], category: mycelium_item.category)
                       .includes(:offers, :claims).to_a
                       .reject { |item| item.need_kind? && item.sorted? }
      rank(candidates) { |item| overlap(item.title, mycelium_item.title) }
    end

    # Your Mycelium items that could cover a need or Actualise item,
    # closest first.
    def mine_for(item, account)
      return [] if item.category.nil?

      candidates = MyceliumItem.where(account_id: account.id, category: item.category).to_a
      rank(candidates) { |mine| overlap(mine.title, item.title) }
    end

    # Tell whoever has shared something that could cover this new need or
    # Actualise item in its emergence. Private: only they hear of it.
    def nudge_for(item)
      return if item.category.nil? || !(item.need_kind? || item.job_kind?)

      offers = Item.offer_kind.where(root_id: item.root_id, need_id: nil, category: item.category)
                   .where.not(mycelium_item_id: nil)
                   .where.not(owner_id: [nil, item.owner_id])
      owners = offers.select { |offer| overlap(offer.title, item.title).positive? }.map(&:owner_id).uniq
      owners.each do |owner_id|
        Kronk::KornerEvents.publish(
          'freethedream.mycelium.matched',
          actor_account_id: item.owner_id,
          recipient_account_id: owner_id,
          item_id: item.id
        )
      end
    end

    def rank(candidates)
      candidates.map { |c| [c, yield(c)] }
                .sort_by { |c, score| [-score, c.title.downcase] }
                .map(&:first)
    end
  end
end
