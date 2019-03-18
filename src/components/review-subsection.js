import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import withLocale from 'components/with-locale';
import Button from 'components/button';

class ReviewSubSection extends React.Component {
  static propTypes = {
    onUpdate: PropTypes.func,
    title: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.node
    ]).isRequired
  }

  static defaultProps = {
    onUpdate: () => {
      console.log('Default onUpdatehandle called in review subsection. Do you forget to pass an update handler?')
    }
  }

  state = {
    editing: false
  }

  isEditMode() {
    return this.state.editing;
  }

  handleToggleEdit = () => {
    this.setState(state => ({ ...state, editing: !this.state.editing }));
  }

  handleUpdate = () => {
    this.setState({ editing: false }, this.props.onUpdate);
  }

  renderTitle() {
    return ( 
      <h2
        className="margin-0 grid-col-fill text-bottom display-inline-block"
        style={{ alignSelf: 'flex-end' }}
      >
        { this.props.title }
      </h2>
    );
  }

  renderEditAction() {
    if (this.isEditMode()) {
      return null;
    }

    return (
      <Button
        type="button"
        className="margin-right-0"
        onClick={this.handleToggleEdit}
      >
        { this.props.t('review.edit.inactive') }
      </Button>
    )
  }

  renderHeader() {
    return (
      <div className="border-bottom-1px border-base-lighter margin-bottom-2">
        <div className="grid-row margin-bottom-05">
          { this.renderTitle() }
          { this.renderEditAction() }
        </div>
      </div>
    )
  }

  renderUpdateAction() {
    if (!this.isEditMode()) {
      return null;
    }

    return (
      <Button
        type="button"
        onClick={this.handleUpdate}
      >
        { this.props.t('review.update') }
      </Button>
    );
  }

  render() {
    const { title } = this.props;
    const editClassName = classnames({
      'bg-primary-lighter padding-2': this.state.editing
    });

    return (
      <div id={`review-subsection-${title}`} className="margin-top-2 margin-bottom-6">
        { this.renderHeader() }
        <div className={editClassName}>
          { this.props.children({ editing: this.state.editing }) }
          { this.renderUpdateAction() }
        </div>
      </div>
    );
  }
}

export default withLocale(ReviewSubSection);