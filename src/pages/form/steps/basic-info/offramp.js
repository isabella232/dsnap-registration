import React from 'react';
import PropTypes from 'prop-types';
import withLocale from 'components/with-locale';
import UI from 'components/ui';
import { MachineState } from 'components/fsm';

class BasicInfoOffRamp extends React.Component {
  static propTypes = {
    t: PropTypes.func,
  }

  render() {
    const { t } = this.props;

    return (
      <MachineState>
        {(state) => (
          <section>
            <UI.Header type="h1" border>
              { /* TODO: need selectors for this data!! */}
              { t(`basicInfo.offramp.header`, { customerName: state.basicInfo.applicantName.firstName }) }
            </UI.Header>
            <div className="grid-col desktop:grid-col-8 margin-y-4 desktop:font-ui-lg">
              <p>
                { t(`basicInfo.offramp.copy`) }
              </p>
            </div>
            <div className="grid-col desktop:grid-col-8 padding-2 desktop:padding-4 margin-y-4 border radius-md desktop:font-ui-lg border-mint text-mint">
              <p>
                { t(`basicInfo.offramp.alerts.success`) }
              </p>
            </div>
          </section>
        )}
      </MachineState>
    );
  }
}

export default withLocale(BasicInfoOffRamp);