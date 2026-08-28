# frozen_string_literal: true

require 'rails_helper'

RSpec.describe StatusPolicy, type: :model do
  subject { described_class }

  let(:admin) { Fabricate(:admin_user) }
  let(:alice) { Fabricate(:account, username: 'alice') }
  let(:bob) { Fabricate(:account, username: 'bob') }
  let(:status) { Fabricate(:status, account: alice) }

  # Kronk reach ladder (docs/kronk_feed_and_reach.md §2).
  def mate!(one, two)
    one.follow!(two)
    two.follow!(one)
  end

  context 'with the permissions of show? and reblog?' do
    permissions :show?, :reblog? do
      it 'grants access when no viewer' do
        expect(subject).to permit(nil, status)
      end

      it 'denies access when viewer is blocked' do
        block = Fabricate(:block)
        status.visibility = :private
        status.account = block.target_account

        expect(subject).to_not permit(block.account, status)
      end
    end
  end

  context 'with the permission of show?' do
    permissions :show? do
      it 'grants access when direct and account is viewer' do
        status.visibility = :direct

        expect(subject).to permit(status.account, status)
      end

      it 'grants access when direct and viewer is mentioned' do
        status.visibility = :direct
        status.mentions = [Fabricate(:mention, account: alice)]

        expect(subject).to permit(alice, status)
      end

      it 'grants access when direct and non-owner viewer is mentioned and mentions are loaded' do
        status.visibility = :direct
        status.mentions = [Fabricate(:mention, account: bob)]
        status.mentions.load

        expect(subject).to permit(bob, status)
      end

      it 'denies access when direct and viewer is not mentioned' do
        viewer = Fabricate(:account)
        status.visibility = :direct

        expect(subject).to_not permit(viewer, status)
      end

      it 'grants access when private and account is viewer' do
        status.visibility = :private

        expect(subject).to permit(status.account, status)
      end

      it 'grants access when private and account is following viewer' do
        follow = Fabricate(:follow)
        status.visibility = :private
        status.account = follow.target_account

        expect(subject).to permit(follow.account, status)
      end

      it 'grants access when private and viewer is mentioned' do
        status.visibility = :private
        status.mentions = [Fabricate(:mention, account: alice)]

        expect(subject).to permit(alice, status)
      end

      it 'denies access when private and viewer is not mentioned or followed' do
        viewer = Fabricate(:account)
        status.visibility = :private

        expect(subject).to_not permit(viewer, status)
      end

      it 'grants self_only access to the owner only' do
        status.visibility = :self_only

        expect(subject).to permit(alice, status)
      end

      it 'denies self_only access to anyone else' do
        status.visibility = :self_only

        expect(subject).to_not permit(bob, status)
      end

      it 'grants mates access to a mutual connection' do
        mate!(alice, bob)
        status.visibility = :mates

        expect(subject).to permit(bob, status)
      end

      it 'denies mates access to a one-way follower' do
        bob.follow!(alice) # one-way, not mutual
        status.visibility = :mates

        expect(subject).to_not permit(bob, status)
      end

      it 'grants orbit access to a mate of a mate' do
        carol = Fabricate(:account, username: 'carol')
        mate!(alice, bob)
        mate!(bob, carol) # carol shares mate bob with alice
        status.visibility = :orbit

        expect(subject).to permit(carol, status)
      end

      it 'grants orbit access to a direct mate too' do
        mate!(alice, bob)
        status.visibility = :orbit

        expect(subject).to permit(bob, status)
      end

      it 'denies orbit access to a stranger with no shared mate' do
        stranger = Fabricate(:account, username: 'stranger')
        status.visibility = :orbit

        expect(subject).to_not permit(stranger, status)
      end
    end
  end

  # Krew is an orthogonal, additive audience axis
  # (docs/rebuild/krew_axis_migration.md): a member of any Krew a status
  # targets sees it regardless of its reach tier, and non-members see only
  # what the reach tier alone grants.
  context 'with the permission of show? for krew-targeted statuses' do
    let(:krew) { Krew.create!(slug: 'squad', name: 'Squad', access: 'open') }
    let(:member) { Fabricate(:account, username: 'member') }
    let(:stranger) { Fabricate(:account, username: 'stranger') }

    before { krew.krew_memberships.create!(account: member) }

    permissions :show? do
      it 'grants a self_only + krew status to a member of that krew (additive)' do
        status.visibility = :self_only
        status.krews << krew

        expect(subject).to permit(member, status)
      end

      it 'denies a self_only + krew status to a non-member' do
        status.visibility = :self_only
        status.krews << krew

        expect(subject).to_not permit(stranger, status)
      end

      it 'grants a mates + krew status to a krew member who is not a mate (additive)' do
        status.visibility = :mates
        status.krews << krew

        expect(subject).to permit(member, status)
      end

      it 'still denies a self_only status with no krew to everyone but the author' do
        status.visibility = :self_only

        expect(subject).to_not permit(member, status)
        expect(subject).to permit(alice, status)
      end
    end
  end

  # Per-post audience "people layer" (docs/rebuild/per_post_audience.md): on a
  # gated post, an explicitly-added account sees it even if the reach tier
  # would not admit them, and an explicitly-removed account cannot see it even
  # if the tier would. The author is never excluded. Public posts are not
  # restrictable (add/remove don't apply).
  context 'with the permission of show? for per-post audience' do
    let(:added) { Fabricate(:account, username: 'added') }
    let(:removed) { Fabricate(:account, username: 'removed') }

    permissions :show? do
      it 'grants a mates status to an added account who is not a mate' do
        status.visibility = :mates
        status.granted_accounts << added

        expect(subject).to permit(added, status)
      end

      it 'grants a self_only status to an added account (the "specific people" case)' do
        status.visibility = :self_only
        status.granted_accounts << added

        expect(subject).to permit(added, status)
      end

      it 'denies a mates status to a removed mate, even though the tier would admit them' do
        mate!(alice, removed)
        status.visibility = :mates
        status.excluded_accounts << removed

        expect(subject).to_not permit(removed, status)
      end

      it 'denies an orbit status to a removed mate-of-mate the tier would admit' do
        carol = Fabricate(:account, username: 'carol')
        mate!(alice, bob)
        mate!(bob, carol)
        status.visibility = :orbit
        status.excluded_accounts << carol

        expect(subject).to_not permit(carol, status)
      end

      it 'never excludes the author from their own post' do
        status.visibility = :mates
        status.excluded_accounts << alice

        expect(subject).to permit(alice, status)
      end

      it 'lets exclusion win over a krew grant (removed beats added)' do
        krew = Krew.create!(slug: 'squad2', name: 'Squad2', access: 'open')
        krew.krew_memberships.create!(account: removed)
        status.visibility = :self_only
        status.krews << krew
        status.excluded_accounts << removed

        expect(subject).to_not permit(removed, status)
      end
    end
  end

  context 'with the permission of quote?' do
    permissions :quote? do
      it 'does not grant access when direct and account is viewer' do
        status.visibility = :direct

        expect(subject).to_not permit(status.account, status)
      end

      it 'does not grant access access when direct and viewer is mentioned but not explicitly allowed' do
        status.visibility = :direct
        status.mentions = [Fabricate(:mention, account: bob)]

        expect(subject).to_not permit(bob, status)
      end

      it 'does not grant access access when direct and viewer is mentioned but not explicitly allowed and mentions are loaded' do
        status.visibility = :direct
        status.mentions = [Fabricate(:mention, account: bob)]
        status.active_mentions.load

        expect(subject).to_not permit(bob, status)
      end

      it 'denies access when direct and viewer is not mentioned' do
        viewer = Fabricate(:account)
        status.visibility = :direct

        expect(subject).to_not permit(viewer, status)
      end

      it 'denies access when private and viewer is not mentioned' do
        viewer = Fabricate(:account)
        status.visibility = :private

        expect(subject).to_not permit(viewer, status)
      end

      it 'grants access when private and viewer is mentioned but not otherwise allowed' do
        status.visibility = :private
        status.mentions = [Fabricate(:mention, account: bob)]

        expect(subject).to_not permit(bob, status)
      end

      it 'denies access when private and non-viewer is mentioned' do
        viewer = Fabricate(:account)
        status.visibility = :private
        status.mentions = [Fabricate(:mention, account: bob)]

        expect(subject).to_not permit(viewer, status)
      end

      it 'denies access when private and account is following viewer' do
        follow = Fabricate(:follow)
        status.visibility = :private
        status.account = follow.target_account

        expect(subject).to_not permit(follow.account, status)
      end

      it 'denies access when public but policy does not allow anyone' do
        viewer = Fabricate(:account)
        expect(subject).to_not permit(viewer, status)
      end

      it 'grants access when public and policy allows everyone' do
        status.quote_approval_policy = Status::QUOTE_APPROVAL_POLICY_FLAGS[:public]
        viewer = Fabricate(:account)
        expect(subject).to permit(viewer, status)
      end

      it 'denies access when public and policy allows followers but viewer is not one' do
        status.quote_approval_policy = Status::QUOTE_APPROVAL_POLICY_FLAGS[:followers]
        viewer = Fabricate(:account)
        expect(subject).to_not permit(viewer, status)
      end

      it 'grants access when public and policy allows followers and viewer is one' do
        status.quote_approval_policy = Status::QUOTE_APPROVAL_POLICY_FLAGS[:followers]
        viewer = Fabricate(:account)
        viewer.follow!(status.account)
        expect(subject).to permit(viewer, status)
      end
    end
  end

  context 'with the permission of reblog?' do
    permissions :reblog? do
      it 'denies access when private' do
        viewer = Fabricate(:account)
        status.visibility = :private

        expect(subject).to_not permit(viewer, status)
      end

      it 'denies access when direct' do
        viewer = Fabricate(:account)
        status.visibility = :direct

        expect(subject).to_not permit(viewer, status)
      end
    end
  end

  context 'with the permissions of destroy? and unreblog?' do
    permissions :destroy?, :unreblog? do
      it 'grants access when account is deleter' do
        expect(subject).to permit(status.account, status)
      end

      it 'denies access when account is not deleter' do
        expect(subject).to_not permit(bob, status)
      end

      it 'denies access when no deleter' do
        expect(subject).to_not permit(nil, status)
      end
    end
  end

  context 'with the permission of favourite?' do
    permissions :favourite? do
      it 'grants access when viewer is not blocked' do
        follow         = Fabricate(:follow)
        status.account = follow.target_account

        expect(subject).to permit(follow.account, status)
      end

      it 'denies when viewer is blocked' do
        block          = Fabricate(:block)
        status.account = block.target_account

        expect(subject).to_not permit(block.account, status)
      end
    end
  end

  context 'with the permission of update?' do
    permissions :update? do
      it 'grants access if owner' do
        expect(subject).to permit(status.account, status)
      end
    end
  end
end
