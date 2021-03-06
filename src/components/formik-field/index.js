import React from 'react';
import PropTypes from 'prop-types';
import { ErrorMessage, FastField, Field, connect, getIn } from 'formik';
import Input from 'components/input';
import MaskedInput from 'components/masked-input';
import InputError from 'components/error';
import Dropdown from 'components/dropdown';
import RadioCheckbox from 'components/radio-checkbox';
import classnames from 'classnames';

const inputTypes = (type) => {
  switch(type) {
    case 'text': return Input;
    case 'select': return Dropdown;
    case 'mask':
    case 'tel':
      return MaskedInput;
    case 'radio':
    case 'checkbox':
      return RadioCheckbox;
    default: return Input
  }
};


// TODO: if an error has been shown once, we need to show the error
// regardless - eg when the submit count is over 1
const FormikError = ({ name }) => {
  return (
    <ErrorMessage name={name}>
      { (message) => <InputError message={message} /> }
    </ErrorMessage>
  );
};

class FormikField extends React.Component {
  static propTypes = {
    /**
     * the `eager` prop controls whether the unerlying formik component
     * is a `FastField` component, which only re-renders when it's value changes,
     * or a `Field` component, which will always re-render.
     * `eager=true` will use a `Field` component.
     */
    eager: PropTypes.bool,
    name: PropTypes.string.isRequired,
    onChange: PropTypes.func,
    showError: PropTypes.bool,
    type: PropTypes.string,
    validate: PropTypes.func
  }

  static defaultProps = {
    eager: true,
    showError: true
  }

  renderError(form) {
    const { name, showError } = this.props;

    if (showError && (form.submitCount || getIn(form.touched, name))) {
      return  <FormikError name={name} />
    }

    return null;
  }

  render() {
    const { name, onChange, onFocus, onBlur, type, eager, validate, ...rest } = this.props;
    const BaseComponent = eager ? Field : FastField;
    const InputComponent = inputTypes(type);
    let preparedProps = { name };

    if (validate) {
      preparedProps = { ...preparedProps, validate };
    }

    return (
      <BaseComponent
        {...preparedProps}
        render={({ field, form }) => {
          return (
            <React.Fragment>
              <InputComponent
                {...field}
                type={type}
                onChange={(eventOrPath, maybeValue) => {
                  onChange && onChange(eventOrPath, maybeValue);
                  field.onChange(eventOrPath, maybeValue);
                }}
                onBlur={(event) => {
                  onBlur && onBlur(event, field, form);
                  field.onBlur(event);
                  event.target.blur();
                }}
                onFocus={(event) => {
                  onFocus && onFocus(event, field, form);
                }}
                onInput={() => form.setFieldTouched(name, true, true)}
                {...rest}
              />
              { this.renderError(form) }
            </React.Fragment>
          );
        }}
      />
    );
  }
}

const FormGroupLabel = ({ labelText }) => (
  !labelText ? null :
  <div className="usa-label margin-bottom-2">
    <p>
      <b>{labelText}</b>
    </p>
  </div>
);

const FormGroupExplanation = ({ text }) => (
  !text ? null :
  <span className="text-base">
    {text}
  </span>
);

const FormikFieldGroup = ({
  explanation,
  fields = [],
  fieldGroupClassname,
  inline,
  labelText,
  Component = FormikField,
  showError,
  name
}) => (
  <div role="group" className={classnames('margin-y-4', fieldGroupClassname)}>
    <FormGroupLabel labelText={labelText} />
    <FormGroupExplanation text={explanation} />
    <div className="margin-top-2">
      { 
        fields.map(({ className, ...field}, index) => {
          const FinalComponent = field.Component ? field.Component : Component;

          return (
            <FinalComponent
              key={`${field.name}.${index}`}
              name={name || field.name}
              {...field}
              groupClassName={classnames({ 'display-inline-block grid-col-2': inline })}
              className={classnames('padding-y-3', className)}
              quietLabel
              showError={showError}
            />
          );
        })
      }
      { !showError ? <FormikError name={name} /> : null }
    </div>
  </div>
);


class FormikFieldDateGroup extends React.Component {
  manageErrors() {
    const { formik: { errors } } = this.props;
    const message = getIn(errors, this.props.name);

    if (!message) {
      return false;
    }

    return <InputError message={message} key={message} />;
  }

  hasErrors() {
    const { formik: { errors } } = this.props;
    const resolved = getIn(errors, this.props.name);

    if (!resolved) {
      return false;
    }

    return Object.keys(resolved).length;
  }

  render() {
    const { 
      explanation,
      fields = [],
      fieldGroupClassname,
      inline,
      labelText,
      Component = FormikField,
      showError,
      name
    } = this.props;

    return (
      <div role="group" className={classnames('margin-y-4', fieldGroupClassname, {
        'usa-form-group-error': this.hasErrors()
      })}>
        <FormGroupLabel labelText={labelText} />
        <FormGroupExplanation text={explanation} />
        <div className="margin-top-2">
          { 
            fields.map(({ className, ...field}, index) => {
              const FinalComponent = field.Component ? field.Component : Component;

              return (
                <FinalComponent
                  key={`${field.name}.${index}`}
                  name={name || field.name}
                  {...field}
                  groupClassName={classnames({ 'display-inline-block grid-col-2': inline })}
                  className={classnames('padding-y-3', className)}
                  quietLabel
                  showError={showError}
                />
              );
            })
          }
          { this.manageErrors() }
        </div>
      </div>
    );
  }
}

const DateGroup = connect(FormikFieldDateGroup);

class FormikRadioGroupBase extends React.Component {
  static propTypes = {
    options: PropTypes.array,
    showError: PropTypes.bool,
  }

  static defaultProps = {
    showError: true
  }

  formGroupClassName() {
    return classnames('usa-form-group margin-y-4', this.props.groupClassName, {
      'usa-form-group-error': this.hasError()
    });
  }

  fieldGroupClassname() {
    const { inline } = this.props;
    return classnames({
      'border radius-md border-base-light margin-right-2 display-inline-block': inline
    });
  }

  fieldClassName() {
    return classnames(this.props.className, {
      'usa-input-error': this.hasError()
    });
  }

  hasError() {
    const { formik: { errors }, name } = this.props;

    return !!getIn(errors, name)
  }

  render() {
    const { options, explanation, inline, ...rest } = this.props;

    return (
      <div role="group" className={this.formGroupClassName()}>
        <FormGroupLabel labelText={this.props.labelText} />
        <FormGroupExplanation text={explanation} />
        <div className="margin-top-2">
            {
              this.props.options.map((option, index) => {
                return (
                  <FormikField
                    key={`${rest.name}.${option.label}.${index}`}
                    {...rest}
                    type="radio"
                    radioValue={option.value}
                    labelText={option.label}
                    id={`${option.label}.${rest.name}`}
                    groupClassName={this.fieldGroupClassname()}
                    className={this.fieldClassName()}
                  />
                );
              })
            }
            { !this.props.showError ? <FormikError name={this.props.name} /> : null }
        </div>
      </div>
    )
  }
}

const FormikRadioGroup = connect(FormikRadioGroupBase);

export { FormikRadioGroup, FormikFieldGroup, DateGroup as FormikFieldDateGroup };
export default FormikField;
