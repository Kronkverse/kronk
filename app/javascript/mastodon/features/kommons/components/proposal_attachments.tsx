import { useCallback, useEffect, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import api from 'mastodon/api';

// Mockups, briefs and references attached to a proposal.
//
// Deliberately plain: the audience for these files is whoever implements
// the proposal, not people browsing Kommons. Upload it, name what it is,
// and the implementer reads it from here instead of from a chat log.
interface Attachment {
  id: string;
  kind: string;
  description: string | null;
  filename: string;
  content_type: string;
  byte_size: number;
  download_url: string;
  uploaded_by: { id: string; username: string };
}

const KINDS = ['mockup', 'brief', 'reference'] as const;

export const ProposalAttachments: React.FC<{ proposalId: string }> = ({
  proposalId,
}) => {
  const [items, setItems] = useState<Attachment[]>([]);
  const [kind, setKind] = useState<string>('mockup');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api().get(
        `/api/v1/proposals/${proposalId}/attachments`,
      );
      setItems(res.data as Attachment[]);
    } catch {
      // An empty list and a failed fetch look the same here; the section
      // simply stays empty rather than breaking the proposal page.
    }
  }, [proposalId]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      const body = new FormData();
      body.append('file', file);
      body.append('kind', kind);
      if (description.trim()) body.append('description', description.trim());

      try {
        await api().post(`/api/v1/proposals/${proposalId}/attachments`, body);
        setDescription('');
        await load();
      } catch (err) {
        setError(
          (err as { response?: { data?: { error?: string } } }).response?.data
            ?.error ?? 'Upload failed',
        );
      } finally {
        setBusy(false);
      }
    },
    [proposalId, kind, description, load],
  );

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void upload(file);
      e.target.value = '';
    },
    [upload],
  );

  const handleKind = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setKind(e.target.value);
    },
    [],
  );

  const handleDescription = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDescription(e.target.value);
    },
    [],
  );

  return (
    <section className='kommons-attachments'>
      <h4 className='kommons-attachments__heading'>
        <FormattedMessage
          id='governance.attachments.heading'
          defaultMessage='For whoever builds this'
        />
      </h4>

      {items.length > 0 && (
        <ul className='kommons-attachments__list'>
          {items.map((a) => (
            <li key={a.id} className='kommons-attachments__item'>
              <span className='kommons-attachments__kind'>{a.kind}</span>
              <a href={a.download_url} className='kommons-attachments__name'>
                {a.filename}
              </a>
              {a.description && (
                <span className='kommons-attachments__desc'>
                  {a.description}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className='kommons-attachments__upload'>
        <select
          value={kind}
          onChange={handleKind}
          className='kommons-attachments__select'
          aria-label='Attachment kind'
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input
          type='text'
          value={description}
          onChange={handleDescription}
          placeholder='What is this, and what is it for?'
          className='kommons-attachments__description'
        />
        <input
          type='file'
          onChange={handleFile}
          disabled={busy}
          className='kommons-attachments__file'
        />
      </div>

      {error && <p className='kommons-attachments__error'>{error}</p>}
    </section>
  );
};
