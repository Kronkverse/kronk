import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiFtdBring } from 'mastodon/api/freethedream';
import type { FtdItem, FtdItemRow } from 'mastodon/api_types/freethedream';

import { act } from './act';

// One tap: "I'll bring it". Less about numbers (Tal, 2026-10-15): if the
// list says pots and you can bring one, tap; bringing two is extra and
// great, and there's no need to say so. Tap again to take it back.

const messages = defineMessages({
  bring: { id: 'freethedream.bring.one_tap', defaultMessage: 'I’ll bring it' },
  bringing: { id: 'freethedream.bring.mine', defaultMessage: 'Bringing ✓' },
  takeBack: {
    id: 'freethedream.bring.take_back',
    defaultMessage: 'Not bringing {title} after all',
  },
});

interface Props {
  need: FtdItemRow;
  onChange: (need: FtdItem) => void;
}

export const BringControl: React.FC<Props> = ({ need, onChange }) => {
  const intl = useIntl();
  const mine = (need.my_quantity ?? 0) > 0;
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(() => {
    setBusy(true);
    void act(apiFtdBring(need.id, mine ? 0 : 1).then(onChange)).finally(() => {
      setBusy(false);
    });
  }, [need.id, mine, onChange]);

  return (
    <button
      type='button'
      className={
        mine
          ? 'freethedream__button freethedream__button--small freethedream__button--quiet'
          : 'freethedream__button freethedream__button--small'
      }
      onClick={toggle}
      disabled={busy}
      aria-pressed={mine}
      title={
        mine
          ? intl.formatMessage(messages.takeBack, { title: need.title })
          : undefined
      }
    >
      {intl.formatMessage(mine ? messages.bringing : messages.bring)}
    </button>
  );
};
