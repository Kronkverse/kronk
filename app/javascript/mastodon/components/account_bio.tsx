import classNames from 'classnames';

import { useAppSelector } from '../store';

import { EmojiHTML } from './emoji/html';
import { useElementHandledLink } from './status/handled_link';

interface AccountBioProps {
  className: string;
  accountId: string;
}

export const AccountBio: React.FC<AccountBioProps> = ({
  className,
  accountId,
}) => {
  const htmlHandlers = useElementHandledLink();

  const note = useAppSelector((state) => {
    const account = state.accounts.get(accountId);
    if (!account) {
      return '';
    }
    return account.note_emojified;
  });
  const extraEmojis = useAppSelector((state) => {
    const account = state.accounts.get(accountId);
    return account?.emojis;
  });

  if (note.length === 0) {
    return null;
  }

  return (
    <EmojiHTML
      htmlString={note}
      extraEmojis={extraEmojis}
      className={classNames(className, 'translate')}
      {...htmlHandlers}
    />
  );
};
