import PropTypes from 'prop-types';
import { Component, cloneElement, Children } from 'react';

import { Switch, Route, useLocation } from 'react-router-dom';

import StackTrace from 'stacktrace-js';

import BundleColumnError from '../components/bundle_column_error';
import { ColumnLoading, StageLoading } from '../components/column_loading';
import BundleContainer from '../containers/bundle_container';

// Small wrapper to pass multiColumn to the route components
export const WrappedSwitch = ({ multiColumn, children }) => {
  const  location = useLocation();

  const decklessLocation = multiColumn && location.pathname.startsWith('/deck')
    ? {...location, pathname: location.pathname.slice(5)}
    : location;

  return (
    <Switch location={decklessLocation}>
      {Children.map(children, child => child ? cloneElement(child, { multiColumn }) : null)}
    </Switch>
  );
};


WrappedSwitch.propTypes = {
  multiColumn: PropTypes.bool,
  children: PropTypes.node,
};

// Small Wrapper to extract the params from the route and pass
// them to the rendered component, together with the content to
// be rendered inside (the children)
export class WrappedRoute extends Component {

  static propTypes = {
    component: PropTypes.func.isRequired,
    content: PropTypes.node,
    multiColumn: PropTypes.bool,
    componentParams: PropTypes.object,
    path: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.string),
    ]),
    // Set on routes whose component renders a <Stage> (not a <Column>) so the
    // lazy-load fallback is the chrome-less stage skeleton. Not needed for
    // routes already under /hub — those are detected from the path.
    stage: PropTypes.bool,
  };

  static defaultProps = {
    componentParams: {},
  };

  static getDerivedStateFromError () {
    return {
      hasError: true,
    };
  }

  state = {
    hasError: false,
    stacktrace: '',
  };

  componentDidCatch (error) {
    StackTrace.fromError(error).then(stackframes => {
      this.setState({ stacktrace: error.toString() + '\n' + stackframes.map(frame => frame.toString()).join('\n') });
    }).catch(err => {
      console.error(err);
    });
  }

  renderComponent = ({ match }) => {
    const { component, content, multiColumn, componentParams } = this.props;
    const { hasError, stacktrace } = this.state;

    if (hasError) {
      return (
        <BundleColumnError
          stacktrace={stacktrace}
          multiColumn={multiColumn}
          errorType='error'
        />
      );
    }

    return (
      <BundleContainer fetchComponent={component} loading={this.renderLoading} error={this.renderError}>
        {Component => <Component params={match.params} multiColumn={multiColumn} {...componentParams}>{content}</Component>}
      </BundleContainer>
    );
  };

  renderLoading = () => {
    const { multiColumn, path, stage } = this.props;

    // Hub / korner routes render into a <Stage>, not a <Column>. Their
    // lazy-load fallback must be the chrome-less stage skeleton — otherwise
    // the legacy <ColumnHeader> bar flashes at the top until the bundle mounts
    // and the Stage replaces it. A route is Stage-shaped if it opts in via
    // `stage`, or any of its paths is under /hub (which also covers array-path
    // routes like Booth/Kalendar/Questions and their non-hub aliases).
    const paths = Array.isArray(path) ? path : [path];
    const isStage =
      stage ||
      paths.some((p) => typeof p === 'string' && p.startsWith('/hub'));

    if (isStage) {
      return <StageLoading />;
    }

    return <ColumnLoading multiColumn={multiColumn} />;
  };

  renderError = (props) => {
    return <BundleColumnError {...props} errorType='network' />;
  };

  render () {
    const { component: Component, content, ...rest } = this.props;

    return <Route {...rest} render={this.renderComponent} />;
  }

}
