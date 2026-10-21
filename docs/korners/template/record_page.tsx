import { KornerDetail } from 'mastodon/components/korner_detail';
import { Stage } from 'mastodon/components/stage';

// One record's page — rendered at the `path:` its manifest names for the
// primary resource (here /hub/mykorner/:id). Built from the kit: <Stage>
// plus <KornerDetail> (CLAUDE.md, "A page inside a korner is built from the
// kit too"). Load the record from the korner's own API; `thing` stands in.
//
// `attached` draws the "Attached" block under the body: what this record
// links to and what links to it, with an Attach button for whoever looks
// after it. Keep it; the server decides who that is
// (Kronk::KornerRecords), so pass the same answer the API gives, usually
// an `is_owner` on the record.

interface Thing {
  id: string;
  title: string;
  is_owner: boolean;
}

export const RecordPage: React.FC<{ thing: Thing }> = ({ thing }) => (
  <Stage>
    <KornerDetail
      title={thing.title}
      back={{ href: '/hub/mykorner', label: 'MyKorner' }}
      attached={{ korner: 'mykorner', id: thing.id, canManage: thing.is_owner }}
    >
      <p>The record — replace with what the korner shows for one thing.</p>
    </KornerDetail>
  </Stage>
);
