import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { withRouter } from 'react-router-dom';
import withLocale from 'components/with-locale';
import UI from 'components/ui';
import SnapshotReview from 'components/snapshot-review';
import Button from 'components/button';
import { getApplicant } from 'models/household';
import { getFullName } from 'models/person';
import './styles.scss';

class ApprovalStatusDisplay extends React.Component {
  static propTypes = {
    approved: PropTypes.bool
  }

  constructor(props) {
    super(props);

    this.scrollRef = React.createRef();
  }

  componentDidUpdate(prevProps) {
    if (
      typeof this.props.approved === 'boolean' &&
      typeof prevProps.approved !== 'boolean'
    ) {
      window.scrollTo(0, this.scrollRef.current.offsetTop);
    }
  }

  render() {
    const { approved } = this.props;
    const computedClassName = classnames('grid-col padding-y-2 padding-x-4 text-white margin-bottom-4', {
      'bg-secondary': !approved,
      'bg-mint': approved
    });

    if (typeof approved !== 'boolean') {
      return null;
    }

    return (
      <div className={computedClassName} ref={this.scrollRef}>
        <UI.Header type="h2">
          { approved ? 'Approved' : 'Denied' }
        </UI.Header>
        <p>Date: Date from server</p>
        <p>By: Email address of worker</p>
      </div>
    );
  }
}

class EligibilityDisplay extends React.Component {
  static propTypes = {
    eligibility: PropTypes.shape({
      eligible: PropTypes.bool,
      findings: PropTypes.arrayOf(
        PropTypes.shape({
          rule: PropTypes.string,
          succeeded: PropTypes.bool,
          text: PropTypes.string
        })
      ),
      metrics: PropTypes.shape({
        allotment: PropTypes.number
      }),
      state: PropTypes.string,
    }).isRequired,
    isOpen: PropTypes.bool
  }

  eligibleClassName(eligible) {
    return classnames('margin-top-2', {
      'text-green': eligible,
      'text-red': !eligible
    });
  }

  render() {
    const { eligibility } = this.props;
    const eligibleClassName = this.eligibleClassName(eligibility.eligible);

    return (
      <section className="grid-col padding-4 bg-accent-warm-lighter text-black margin-bottom-4">
        <div className="font-sans-lg margin-bottom-2">
          <span>
            Based on the information below, this applicant appears to be:
          </span>
          <p className={eligibleClassName}>
            <b>
              { eligibility.eligible ? 'Eligible' : 'Ineligible' }
            </b>
          </p>
        </div>
        <p className="font-sans-md margin-top-4 margin-bottom-2">
          <b>Findings</b>
        </p>
        <ul className="add-list-reset fa">
          {
            eligibility.findings.map((finding, index) => {
              const listItemClass = classnames('margin-bottom-2 margin-left-2', {
                'success': finding.succeeded,
                'failure': !finding.succeeded,
              });

              return (
                <li
                  key={`findings.${index}`}
                  className={listItemClass}
                >
                  { finding.text }
                </li>
              )
            })
          }
        </ul>
        <p className="font-sans-md margin-top-4 margin-bottom-1">
          <b>Allotment</b>
        </p>
        <span>
          ${eligibility.metrics.allotment}
        </span>
      </section>
    );
  }
}


class WorkerReview extends React.Component {
  constructor(props) {
    super(props);
    this.scrollRef = React.createRef();
  }

  componentDidMount() {
    const { machineState: { currentRegistration } } = this.props;

    if (currentRegistration === null || currentRegistration === undefined) {
      this.props.history.push('/worker/search');
    }
  }

  handleUpdate = (values) => {
    console.log(this.props)
  }

  handleApprove = () => {
    this.props.transition({ command: 'APPROVE' });
  }

  handleDeny = () => {
    this.props.transition({ command: 'DENY' });
  }

  render() {
    const { machineState, t } = this.props;
    const registration = machineState.currentRegistration;

    if (!registration) {
      return null;
    }

    return (
      <React.Fragment>
        <div className="margin-bottom-4">
          <UI.Header
            border
            text={getFullName(getApplicant(registration.client.household))}
          >
            <div>
              <p>{ t('worker.search.id.label') }:</p>
              <b>{ registration.client.id }</b>
            </div>
          </UI.Header>
        </div>
        <ApprovalStatusDisplay approved={machineState.approval} />
        <EligibilityDisplay eligibility={machineState.eligibility} />
        <SnapshotReview
          values={{ disasters: machineState.disasters, ...registration.client }}
          onNext={this.handleUpdate}
          render={(formik) => {
            console.log(formik)
            return (
              typeof machineState.approval === 'boolean' ?
              null :
              <div>
                <Button
                  className="worker-approve bg-mint"
                  disabled={formik.isSubmitting}
                  onClick={this.handleApprove}
                >
                  Approve
                </Button>
                <Button
                  className="worker-deny bg-red"
                  disabled={formik.isSubmitting}
                  onClick={this.handleDeny}
                >
                  Deny
                </Button>
              </div>
            );
          }}
        />
      </React.Fragment>
    )
  }
}

export default withRouter(withLocale(WorkerReview));