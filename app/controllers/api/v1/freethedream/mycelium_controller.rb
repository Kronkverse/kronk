# frozen_string_literal: true

# Your Mycelium: what you have, private to you (docs/spaces/freethedream.md,
# Mycelium). Offering something into an emergence you're in is sharing it:
# it shows in that emergence's On offer. Bringing it against a need goes
# through ItemsController#bring with `mycelium_item_id`.
#
#   GET    /mycelium                       yours, by category
#   GET    /mycelium?for_item=:id          yours that could cover that need
#                                          or Actualise item, closest first
#   POST   /mycelium                       { mycelium_item: { category, title, note, quantity } }
#   PUT    /mycelium/:id
#   DELETE /mycelium/:id                   withdraws its offers on their own
#   POST   /mycelium/:id/offer             { project_id, quantity }
#   POST   /mycelium/:id/withdraw          { project_id }
#   GET    /mycelium/:id/suggestions?project_id=  what it could cover there
class Api::V1::Freethedream::MyceliumController < Api::V1::Freethedream::BaseController
  before_action :set_mine, except: [:index, :create]

  def index
    items = mine.includes(offers: [:root, :need]).by_category.to_a
    items = closest_for(items) if params[:for_item].present?

    render json: items.map { |item| view.mycelium_item(item) }
  end

  def create
    item = mine.new(mycelium_params)
    return render_invalid(item) unless item.save

    render json: view.mycelium_item(item), status: 201
  end

  def update
    return render_invalid(@item) unless @item.update(mycelium_params)

    # Its offers say what it is.
    @item.offers.update_all(title: @item.title, category: Freethedream::Item.categories[@item.category])
    render json: view.mycelium_item(@item)
  end

  def destroy
    @item.destroy!
    render_empty
  end

  def offer
    emergence = emergence_param
    offer = @item.offer!(emergence, quantity: params[:quantity].presence || @item.quantity)
    log!(emergence, offer, 'offer_added', quantity: offer.quantity) if offer.previously_new_record?
    render json: view.mycelium_item(@item.reload)
  end

  def withdraw
    @item.withdraw!(emergence_param)
    render json: view.mycelium_item(@item.reload)
  end

  def suggestions
    render json: view.suggestions(@item, emergence_param)
  end

  private

  def mine
    Freethedream::MyceliumItem.where(account_id: current_account.id)
  end

  def set_mine
    @item = mine.find(params[:id])
  end

  def emergence_param
    emergence = Freethedream::Project.find(params.require(:project_id)).top
    require_member!(emergence)
    emergence
  end

  def closest_for(items)
    target = Freethedream::Item.find(params[:for_item])
    require_member!(target.root)
    by_id = items.index_by(&:id)
    Freethedream::MyceliumMatch.mine_for(target, current_account).filter_map { |item| by_id[item.id] }
  end

  def log!(project, item, verb, **data)
    details = { title: item.title, quantity: item.quantity, unit: item.unit }.merge(data)
    Freethedream::Activity.log!(project: project, account: current_account, verb: verb, item: item, **details)
  end

  def mycelium_params
    params.expect(mycelium_item: [:category, :title, :note, :quantity])
  end
end
