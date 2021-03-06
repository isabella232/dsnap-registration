import React from 'react';
import PropTypes from 'prop-types';
import { FieldArray, yupToFormErrors } from 'formik';
import withLocale from 'components/with-locale';
import withUpdateable from 'components/with-updateable';
import FormikField, { FormikFieldDateGroup, FormikRadioGroup } from 'components/formik-field';
import YesNoField from 'components/yes-no-field';
import ReviewSubSection from 'components/review-subsection';
import ReviewTableCollection from 'components/review-table-collection';
import ReviewTable, { Header, HeaderAction} from 'components/review-table';
import Button from 'components/button';
import { getFirstName, getFullName, getDOB } from 'models/person';
import { getOtherMembers, addPeopleToHousehold, deleteMemberFromHousehold } from 'models/household';
import { isAffirmative } from 'utils';
import NameFields from 'components/name-input';
import { householdReviewValidator } from 'schemas/snapshot-review/household';
import { helpers } from 'locales';

class HouseholdMemberReviewForm extends React.Component {
  static propTypes = {
    member: PropTypes.object,
    memberIndex: PropTypes.string,
    t: PropTypes.func,
  }

  updateMask = (name, data) => {
    this.props.handleChange(name)(data);
  };

  removeMember = () => {
    this.props.onRemove(this.props.memberIndex);
  }

  render() {
    const { member, memberIndex, t, handleChange } = this.props;

    return (
      <div className="margin-bottom-2">
        <Header title={this.props.header}>
          <HeaderAction
            text={t('general.delete')}
            onClick={this.removeMember}
            className="margin-right-0"
            link
          />
        </Header>
        <NameFields memberIndex={memberIndex} />
        <FormikFieldDateGroup
          inline
          name={`household.members.${memberIndex}.dob`}
          showError={false}
          labelText={t('identity.personalInfo.dob.label')}
          explanation={t('identity.personalInfo.dob.explanation')}
          fields={[{
            name: `household.members.${memberIndex}.dob.month`,
            onChange: handleChange,
            labelText: t('identity.personalInfo.dob.month'),
          }, {
            name: `household.members.${memberIndex}.dob.day`,
            labelText: t('identity.personalInfo.dob.day'),
            onChange: handleChange
          }, {
            name: `household.members.${memberIndex}.dob.year`,
            labelText: t('identity.personalInfo.dob.year'),
            onChange: handleChange,
            className: 'desktop:grid-col-9'
          }]}
        />
        <FormikField
          type="mask"
          pattern="XXX-XX-XXXX"
          delimiter="-"
          name={`household.members.${memberIndex}.ssn`}
          onChange={this.updateMask}
          labelText={t('household.memberDetails.ssn.label', { firstName: getFirstName(member) })}
        />
        <FormikRadioGroup
          name={`household.members.${memberIndex}.ethnicity`}
          labelText={t('household.memberDetails.ethnicity.label', { firstName: getFirstName(member) })}
          explanation={t('general.leaveBlank')}
          options={helpers.getEnumeratedValues('general.ethnicity.options')}
        />
        <FormikRadioGroup
          name={`household.members.${memberIndex}.race`}
          labelText={t('household.memberDetails.race.label', { firstName: getFirstName(member) })}
          explanation={t('general.leaveBlank')}
          options={helpers.getEnumeratedValues('general.race.options')}
        />
        <YesNoField
          name={`household.members.${memberIndex}.hasFoodAssistance`}
          labelText={t('household.foodAssistance.id')}
        />
      </div>
    );
  }
}

class HouseholdReview extends React.Component {
  getMemberData(member) {
    const { t } = this.props;

    return [
      {
        name: t('basicInfo.name.id'),
        data: getFullName(member),
      },
      {
        name: t('identity.personalInfo.dob.id'),
        data: getDOB(member),
      },
      {
        name: t('identity.personalInfo.ssn.id'),
        data: member.ssn,
      },
      {
        name: t('identity.personalInfo.race.id'),
        data: member.race || 'n/a',
      },
      {
        name: t('identity.personalInfo.ethnicity.id'),
        data: member.ethnicity || 'n/a',
      },
      {
        name: t('household.foodAssistance.id'),
        data: member.hasFoodAssistance ? t('general.yes'): t('general.no')
      },
    ];
  }

  handleRemoveMember = (index) => {
    const { formik } = this.props;
    const { household } = formik.values;
    const nextHousehold = deleteMemberFromHousehold(household, index);
    const nextState = {
      ...formik.values,
      household: nextHousehold
    };

    formik.setValues(nextState);
  }

  handleAddMember = () => {
    const { formik } = this.props;
    const { values } = formik;
    const nextState = {
      ...values,
      household: addPeopleToHousehold(values.household, 1),
    };

    formik.setValues(nextState);
  }

  handleToggleEdit = (isEditing) => {
    if (isEditing) {
      this.props.onEdit(this.validateSection);
    }
  }

  validateSection = () => {
    const e = householdReviewValidator(this.props.formik.values);

    if (!Object.keys(e).length) {
      return e;
    }

    return yupToFormErrors(e)
  }

  render() {
    const { t, formik } = this.props;
    const { household } = formik.values;

    return (
      <ReviewSubSection
        title={this.props.title}
        onUpdate={this.props.handleUpdate}
        onEdit={this.handleToggleEdit}
        readonly={this.props.readonly}
      >
        {({ editing }) => {
          return (
            <ReviewTableCollection fallback={t('household.memberDetails.none')}>
              <FieldArray
                name="household.members"
                render={() => {
                  return (
                    getOtherMembers(household).map((member, index) => {
                      const memberIndex = index + 1;
                      const header = `${t('general.person')} ${memberIndex}`;
    
                      return (
                        editing ?
                        <HouseholdMemberReviewForm
                          t={t}
                          header={header}
                          member={member}
                          memberIndex={memberIndex}
                          onRemove={this.handleRemoveMember}
                          handleChange={this.props.handleChange}
                        /> :
                        <ReviewTable
                          key={`review.household.${index}`}
                          primaryData={this.getMemberData(member)}
                        />
                      );
                    })
                  );
                }}
              />
              {
                !editing ? null :
                <Button
                  disabled={!isAffirmative(editing)}
                  type="button"
                  onClick={this.handleAddMember}
                >
                  { t('review.addMember') }
                </Button>
              }
            </ReviewTableCollection>
          );
        }}
      </ReviewSubSection>
    );
  }
}

export default withUpdateable(withLocale(HouseholdReview));
