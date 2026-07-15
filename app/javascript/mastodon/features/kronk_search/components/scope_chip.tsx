import { defineMessages, useIntl } from 'react-intl';

import type { SearchScope } from '../hooks/useSearchScope';

const messages = defineMessages({
  scopeKorner: {
    id: 'kronk_search.scope.korner',
    defaultMessage: 'Searching {slug}',
  },
  scopeAccount: {
    id: 'kronk_search.scope.account',
    defaultMessage: 'Searching @{acct}',
  },
  scopeUniversal: {
    id: 'kronk_search.scope.universal',
    defaultMessage: 'All of Kronk',
  },
  widen: {
    id: 'kronk_search.scope.widen',
    defaultMessage: 'Widen',
  },
});

interface Props {
  scope: SearchScope;
  onWiden?: () => void;
}

export const ScopeChip: React.FC<Props> = ({ scope, onWiden }) => {
  const intl = useIntl();

  const label = (() => {
    switch (scope.kind) {
      case 'universal':
        return intl.formatMessage(messages.scopeUniversal);
      case 'korner':
        return intl.formatMessage(messages.scopeKorner, { slug: scope.slug });
      case 'account':
        return intl.formatMessage(messages.scopeAccount, { acct: scope.acct });
    }
  })();

  return (
    <div className='kronk-search__scope-chip' role='status'>
      <span className='kronk-search__scope-label'>{label}</span>
      {scope.kind !== 'universal' && onWiden && (
        <button
          type='button'
          className='kronk-search__scope-widen'
          onClick={onWiden}
        >
          {intl.formatMessage(messages.widen)}
        </button>
      )}
    </div>
  );
};
