// Not yet Mates — the foot of your own Mates list. Two short lists of
// one-way connections, each with the shared account row and its Mate
// button:
//
//   Waiting on them  people you asked (or added before Mates) who haven't
//                    added you back. The button withdraws a request.
//   Not Mates yet    people who added you before Mates and were never
//                    added back. The button makes it mutual.
//
// Requests to you aren't here; they're on /mate_requests. This took over
// from the Rails Follows and followers page (Tal, 2026-11-24), which now
// redirects to this list. Endpoint:
// Api::V1::Kommunity::NotYetMatesController. Either list is left out when
// it's empty, so most people never see this at all.

import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { importFetchedAccounts } from 'mastodon/actions/importer';
import { apiRequestGet } from 'mastodon/api';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Account } from 'mastodon/components/account';
import { useAppDispatch } from 'mastodon/store';

const messages = defineMessages({
  sent: { id: 'mates_tab.not_yet.sent', defaultMessage: 'Waiting on them' },
  sentHint: {
    id: 'mates_tab.not_yet.sent_hint',
    defaultMessage: "You've asked. They haven't said yet.",
  },
  received: {
    id: 'mates_tab.not_yet.received',
    defaultMessage: 'Not Mates yet',
  },
  receivedHint: {
    id: 'mates_tab.not_yet.received_hint',
    defaultMessage: 'They added you before Mates. Make it mutual, or leave it.',
  },
});

interface NotYetMatesJSON {
  sent: ApiAccountJSON[];
  received: ApiAccountJSON[];
}

export const NotYetMates: React.FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [lists, setLists] = useState<{ sent: string[]; received: string[] }>({
    sent: [],
    received: [],
  });

  useEffect(() => {
    let live = true;

    apiRequestGet<NotYetMatesJSON>('v1/kommunity/not_yet_mates')
      .then((data) => {
        if (!live) return;
        dispatch(importFetchedAccounts([...data.sent, ...data.received]));
        setLists({
          sent: data.sent.map((account) => account.id),
          received: data.received.map((account) => account.id),
        });
      })
      .catch(() => {
        // Silent: the Mates list above stands on its own.
      });

    return () => {
      live = false;
    };
  }, [dispatch]);

  const sections = [
    {
      key: 'sent',
      ids: lists.sent,
      title: messages.sent,
      hint: messages.sentHint,
    },
    {
      key: 'received',
      ids: lists.received,
      title: messages.received,
      hint: messages.receivedHint,
    },
  ].filter((section) => section.ids.length > 0);

  return (
    <>
      {sections.map((section) => (
        <section key={section.key} className='mates-tab__not-yet'>
          <h3 className='korner-section-heading'>
            {intl.formatMessage(section.title)}
          </h3>
          <p className='mates-tab__hint'>{intl.formatMessage(section.hint)}</p>
          <div className='mates-list'>
            {section.ids.map((id) => (
              <Account key={id} id={id} withMenu={false} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
};
