import type { Meta, StoryObj } from '@storybook/react-vite';

import { accountFactoryState } from '@/testing/factories';

import { HoverCardController } from '../hover_card_controller';

import type { HandledLinkProps } from './handled_link';
import { HandledLink } from './handled_link';

type HandledLinkStoryProps = Pick<
  HandledLinkProps,
  'href' | 'text' | 'prevText'
> & {
  mentionAccount: 'local' | 'remote' | 'none';
};

const meta = {
  title: 'Components/Status/HandledLink',
  render({ mentionAccount, ...args }) {
    let mention: HandledLinkProps['mention'] | undefined;
    if (mentionAccount === 'local') {
      mention = { id: '1', acct: 'testuser' };
    } else if (mentionAccount === 'remote') {
      mention = { id: '2', acct: 'remoteuser@mastodon.social' };
    }
    return (
      <>
        <HandledLink {...args} mention={mention}>
          <span>{args.text}</span>
        </HandledLink>
        <HoverCardController />
      </>
    );
  },
  args: {
    href: 'https://example.com/path/subpath?query=1#hash',
    text: 'https://example.com',
    mentionAccount: 'none',
  },
  argTypes: {
    mentionAccount: {
      control: { type: 'select' },
      options: ['local', 'remote', 'none'],
      defaultValue: 'none',
    },
  },
  parameters: {
    state: {
      accounts: {
        '1': accountFactoryState({ id: '1', acct: 'hashtaguser' }),
      },
    },
  },
} satisfies Meta<HandledLinkStoryProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Simple: Story = {
  args: {
    href: 'https://example.com/test',
  },
};

export const Hashtag: Story = {
  args: {
    text: '#example',
  },
};

export const Mention: Story = {
  args: {
    text: '@user',
    mentionAccount: 'local',
  },
};

export const InternalLink: Story = {
  args: {
    href: '/explore',
    text: 'Explore',
  },
};

export const InvalidURL: Story = {
  args: {
    href: 'ht!tp://invalid-url',
    text: 'ht!tp://invalid-url -- invalid!',
  },
};
