import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Redirect, useParams } from 'react-router-dom';

import { apiFtdProject } from 'mastodon/api/freethedream';
import type { FtdProject } from 'mastodon/api_types/freethedream';
import { KornerDetail } from 'mastodon/components/korner_detail';

import { ItemComposer } from './item_composer';
import { Loading, useLoaded } from './shared';
import type { WorkList } from './work';
import { RENAMED_LISTS, WorkBody, isWorkList, workMessages } from './work';

// One of an emergence's lists on its own page, reached from the cards on
// its landing page: /hub/freethedream/p/:id/actualise and the like.

export const WorkPage: React.FC = () => {
  const { id, list } = useParams<{ id: string; list: string }>();
  const { data: project, failed, set } = useLoaded(id, () => apiFtdProject(id));

  if (!isWorkList(list)) {
    const renamed = RENAMED_LISTS[list] as WorkList | undefined;
    return (
      <Redirect
        to={`/hub/freethedream/p/${id}${renamed ? `/${renamed}` : ''}`}
      />
    );
  }
  if (!project) return <Loading failed={failed} />;
  return <WorkView project={project} list={list} onChange={set} />;
};

const WorkView: React.FC<{
  project: FtdProject;
  list: WorkList;
  onChange: (p: FtdProject) => void;
}> = ({ project, list, onChange }) => {
  const intl = useIntl();
  const [offering, setOffering] = useState(false);

  const refresh = useCallback(() => {
    void apiFtdProject(project.id).then(onChange);
  }, [project.id, onChange]);
  const openOffer = useCallback(() => {
    setOffering(true);
  }, []);
  const closeOffer = useCallback(() => {
    setOffering(false);
  }, []);
  const handleOffered = useCallback(() => {
    setOffering(false);
    refresh();
  }, [refresh]);

  return (
    <KornerDetail
      className='freethedream-detail'
      back={{ href: `/hub/freethedream/p/${project.id}`, label: project.title }}
      title={intl.formatMessage(workMessages[list])}
    >
      <WorkBody
        project={project}
        list={list}
        refresh={refresh}
        onOffer={openOffer}
      />
      {offering && (
        <ItemComposer
          kind='offer'
          project={project}
          onCancel={closeOffer}
          onSaved={handleOffered}
        />
      )}
    </KornerDetail>
  );
};
