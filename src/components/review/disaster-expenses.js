import React from 'react';
import withLocale from 'components/with-locale';
import withUpdateable from 'components/with-updateable';
import CurrencyInput from 'components/currency-input';
import ReviewSubSection from 'components/review-subsection';
import ReviewTable from 'components/review-table';
import { getExpenseTotal, getExpenses } from 'models/impact';
import { getApplicableValue } from 'models/applicable';
import { expenseReviewValidator } from 'schemas/snapshot-review/expenses';

class DisasterExpensesReviewForm extends React.Component {
  updateMask = (name, value) => {
    this.props.handleChange(name)(value);
  }

  render() {
    const { t, expenses } = this.props;

    return (
      <div className="margin-bottom-2">
        { Object.keys(expenses).map((key, index) => 
            <CurrencyInput
              key={`${key}.${index}`}
              onChange={this.updateMask}
              labelText={t(`impact.expenses.${key}`)}
              name={`impact.otherExpenses.${key}.value`}
            />
          )
        }
      </div>
    );
  }
}

class DisasterExpensesReview extends React.Component {
  getExpenses() {
    const { formik, t } = this.props;
    const { impact } = formik.values;
    const expenseFields = Object.entries(getExpenses(impact)).map(([key, expense]) => ({
      name: t(`impact.expenses.${key}`),
      data: `$${getApplicableValue(expense)}`,
    }));


    return expenseFields.concat([
      {
        name: t('impact.otherExpenses.total'),
        data: `$${getExpenseTotal(impact)}`,
      }
    ]);
  }

  validateSection = () => {
    const { impact } = this.props.formik.values;

    const values = {
      impact: {
        otherExpenses: {
          ...getExpenses(impact)
        }
      }
    };

    return expenseReviewValidator(values);
  }

  handleToggleEdit = (isEditing) => {
    if (isEditing) {
      this.props.onEdit(this.validateSection);
    }
  }

  render() {
    const { t } = this.props;
    
    return (
      <ReviewSubSection
        onEdit={this.handleToggleEdit}
        title={t('review.sections.impact')}
        onUpdate={this.props.handleUpdate}
        readonly={this.props.readonly}
      >
        {({ editing }) => {
          return (
            editing ?
            <DisasterExpensesReviewForm
              t={t}
              expenses={getExpenses(this.props.formik.values.impact)}
              handleChange={this.props.handleChange}
            /> :
            <ReviewTable
              editing={editing}
              primaryData={this.getExpenses()}
            />
          )
        }}
      </ReviewSubSection>
    );
  }
}

export default withUpdateable(withLocale(DisasterExpensesReview));
