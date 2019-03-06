import React from 'react';
import withLocale from 'components/with-locale';
import Wizard from 'components/wizard';
import FormikField, { FormikFieldGroup } from 'components/formik-field';
import { buildNestedKey } from 'utils';
import { getMembers } from 'models/household';
import { hasIncome } from 'models/assets-and-income';
import { getIncome } from 'models/person';
import { getFirstName, getLastName } from 'models/person';
import SecurityAlert from 'components/security-alert';
import Collapsible from 'components/collapsible';

const modelName = 'otherExpenses';

const setMembersWithIncome = (household, members) => () => ({
  household: {
    ...household,
    members
  },
  resources: {
    membersWithIncome: members.reduce((memo, member, index) => {
      if (hasIncome(getIncome(member))) {
        memo.push(index);
      }

      return memo;
    }, [])
  },
});

class Assets extends React.Component {
  render() {
    const { handleChange, sectionName, registerStep, t } = this.props;

    return (
      <Wizard.Context>
        {({ basicInfo, household }) => {
          const members = getMembers(household);

          return (
            <Wizard.Step
              header={t(`${buildNestedKey(sectionName, 'header')}`)}
              registerStep={registerStep}
              modelName={modelName}
              onNext={setMembersWithIncome(household, members)}
            >
              <FormikField
                labelText={t(buildNestedKey(sectionName, 'moneyOnHand', 'label'))}
                explanation={t(buildNestedKey(sectionName, 'moneyOnHand', 'explanation'))}
                name={buildNestedKey('household', 'members', basicInfo.personId, 'assetsAndIncome', 'moneyOnHand')}
                onChange={handleChange}
              />
              <FormikFieldGroup
                labelText={t(buildNestedKey(sectionName, 'incomeRecipients', 'label'))}
                fieldGroupClassname="margin-y-0"
                fields={
                  members.map((member, index) => {
                    return {
                      type: 'checkbox',
                      name: buildNestedKey('household', 'members', index, 'assetsAndIncome', 'hasIncome'),
                      onChange: handleChange,
                      labelText: `${getFirstName(member)} ${getLastName(member)}`,
                      quietLabel: true,
                    }
                  })
                }
              />
              <Collapsible
                header={t(buildNestedKey(sectionName, 'whyWeAsk', 'header'))}
                body={t(buildNestedKey(sectionName, 'whyWeAsk', 'copy'))}
              />
              <SecurityAlert />
            </Wizard.Step>
          )
        }}
      </Wizard.Context>
    )
  }
}

export { Assets }
export default withLocale(Assets);