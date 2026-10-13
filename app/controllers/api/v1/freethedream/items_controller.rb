# frozen_string_literal: true

# Ideas, needs, jobs and offers. Anyone in the project adds them and owns
# what they add; claiming a job slot, offering against a need and taking
# on an idea are open to every member.
class Api::V1::Freethedream::ItemsController < Api::V1::Freethedream::BaseController
  before_action :set_item, except: [:create]

  def show
    render json: view.item(@item)
  end

  # Placed in project_id; an offer against a need without one lands where
  # the need is.
  def create
    need = params.dig(:item, :need_id).presence && Freethedream::Item.find(params[:item][:need_id])
    project = if params.dig(:item, :project_id).present?
                Freethedream::Project.find(params[:item][:project_id])
              elsif need
                need.projects.order(:id).first
              end
    raise ActiveRecord::RecordNotFound if project.nil?

    require_member!(project)

    item = Freethedream::Item.new(item_params.merge(root_id: project.top_id, owner: current_account, need: need))
    item.kind = 'offer' if need
    Freethedream::Item.transaction do
      item.save!
      item.placements.create!(project: project)
    end
    log!(project, item, "#{item.kind}_added")
    render json: view.item(item), status: 201
  rescue ActiveRecord::RecordInvalid
    render_invalid(item)
  end

  def update
    permit!(@item.owned_by?(current_account))
    return render_invalid(@item) unless @item.update(item_params.except(:kind))

    render json: view.item(@item)
  end

  def destroy
    permit!(@item.owned_by?(current_account))
    Freethedream::Comment.where(subject: @item).delete_all
    @item.destroy!
    render_empty
  end

  def claim
    require_member!(@item.root)
    claim = @item.claims.new(account: current_account)
    return render_invalid(claim) unless claim.save

    log!(home, @item, 'claimed')
    render json: view.item(@item)
  end

  # "I'll bring 3": set how much of a need you're bringing. 0 takes your
  # offer back. Your offer is an ordinary offer item, so it shows on the
  # need and in the audit like any other.
  def bring
    require_member!(@item.root)
    permit!(@item.need_kind?)
    amount = params.require(:quantity).to_i.clamp(0, Freethedream::Item::QUANTITY_MAX)
    offers = @item.offers.where(owner_id: current_account.id).order(:id).to_a
    mine = offers.shift
    offers.each(&:destroy!)
    before = mine&.quantity || 0

    if amount.zero?
      mine&.destroy!
    elsif mine
      mine.update!(quantity: amount)
    else
      mine = Freethedream::Item.create!(kind: :offer, need: @item, root_id: @item.root_id, owner: current_account, title: @item.title, unit: @item.unit, category: @item.category, quantity: amount)
      mine.placements.create!(project: home)
    end
    log!(home, @item, 'bringing', quantity: amount, unit: @item.unit) if amount > before

    render json: view.item(@item.reload)
  end

  def unclaim
    @item.claims.where(account_id: current_account.id).delete_all
    render json: view.item(@item)
  end

  # "I'll make this happen": the idea becomes a part or a job, owned by
  # whoever took it on, in the part where the idea sits.
  def take_on
    require_member!(@item.root)
    permit!(@item.idea_kind? && @item.taken_on_as.nil?)
    if params[:as] == 'job'
      job = Freethedream::Item.new(kind: :job, title: @item.title, body: @item.body, root_id: @item.root_id, owner: current_account, source_idea: @item)
      Freethedream::Item.transaction do
        job.save!
        job.placements.create!(project: home)
      end
      log!(home, @item, 'taken_on')
      render json: { type: 'job', id: job.id.to_s }
    else
      part = Freethedream::Project.create!(parent: home, title: @item.title, description: @item.body, owner: current_account, source_idea: @item)
      log!(home, @item, 'taken_on')
      render json: { type: 'part', id: part.id.to_s }
    end
  end

  def take_over
    take_over!(@item, @item.root)
    render json: view.item(@item)
  end

  def hand_over
    hand_over!(@item, @item.root)
    render json: view.item(@item)
  end

  private

  def set_item
    @item = Freethedream::Item.find(params[:id])
  end

  # The section an item first went into.
  def home
    @home ||= @item.projects.order('freethedream_placements.id').first
  end

  def log!(project, item, verb, **data)
    details = { title: item.title, quantity: item.quantity, unit: item.unit }.merge(data)
    Freethedream::Activity.log!(project: project, account: current_account, verb: verb, item: item, **details)
  end

  def item_params
    params.expect(item: [:kind, :title, :body, :category, :quantity, :unit, :asset_id])
  end
end
