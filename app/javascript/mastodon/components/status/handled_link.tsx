import { useCallback } from 'react';
import type { ComponentProps, FC } from 'react';

import classNames from 'classnames';
import { Link } from 'react-router-dom';

import type { ApiMentionJSON } from '@/mastodon/api_types/statuses';
import type { OnElementHandler } from '@/mastodon/utils/html';

export interface HandledLinkProps {
  href: string;
  text: string;
  prevText?: string;
  mention?: Pick<ApiMentionJSON, 'id' | 'acct'>;
}

export const HandledLink: FC<HandledLinkProps & ComponentProps<'a'>> = ({
  href,
  text,
  prevText,
  mention,
  className,
  children,
  ...props
}) => {
  // Hashtags were retired from the UI on 2026-11-24 (docs/decisions.md):
  // a tag in a post reads as the plain word, with no # and no link. The
  // tag still exists on the server, so this is where to bring them back.
  if (
    (text.startsWith('#') ||
      prevText?.endsWith('#') ||
      text.startsWith('＃') ||
      prevText?.endsWith('＃')) &&
    !text.includes('%')
  ) {
    const hashtag = text.replace(/^[#＃]/, '').trim();

    return <span className={className}>{hashtag}</span>;
  } else if (mention) {
    // Handle mentions
    return (
      <Link
        className={classNames('mention', className)}
        to={`/@${mention.acct}`}
        title={`@${mention.acct}`}
        data-hover-card-account={mention.id}
      >
        {children}
      </Link>
    );
  }

  // Non-absolute paths treated as internal links. This shouldn't happen, but just in case.
  if (href.startsWith('/')) {
    return (
      <Link className={classNames('unhandled-link', className)} to={href}>
        {children}
      </Link>
    );
  }

  return (
    <a
      {...props}
      href={href}
      title={href}
      className={classNames('unhandled-link', className)}
      target='_blank'
      rel='noopener'
      translate='no'
    >
      {children}
    </a>
  );
};

export const useElementHandledLink = ({
  hrefToMention,
}: {
  hrefToMention?: (href: string) => ApiMentionJSON | undefined;
} = {}) => {
  const onElement = useCallback<OnElementHandler>(
    (element, { key, ...props }, children) => {
      if (element instanceof HTMLAnchorElement) {
        const mention = hrefToMention?.(element.href);
        return (
          <HandledLink
            {...props}
            key={key as string} // React requires keys to not be part of spread props.
            href={element.href}
            text={element.innerText}
            prevText={element.previousSibling?.textContent ?? undefined}
            mention={mention}
          >
            {children}
          </HandledLink>
        );
      }
      return undefined;
    },
    [hrefToMention],
  );
  return { onElement };
};
