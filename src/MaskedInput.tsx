/* eslint-disable max-lines */
import { KeyboardEvent, FormEvent, ClipboardEvent } from 'react';
import React from 'react';
import { InputMask, InputMaskProps } from '@jaredrolt/inputmask-core';
import { FormatCharacters } from './FormatCharacters';

const KEYCODE_Z = 90;
const KEYCODE_Y = 89;

const isUndo = (e: KeyboardEvent) =>
  (e.ctrlKey || e.metaKey) && e.keyCode === (e.shiftKey ? KEYCODE_Y : KEYCODE_Z);

const isRedo = (e: KeyboardEvent) =>
  (e.ctrlKey || e.metaKey) && e.keyCode === (e.shiftKey ? KEYCODE_Z : KEYCODE_Y);

const getSelection = (el: HTMLInputElement) => ({
  start: el.selectionStart || 0,
  end: el.selectionEnd || 0,
});

const setSelection = (
  el: FormEvent<HTMLInputElement>['currentTarget'],
  selection: { start: number; end: number },
) => {
  el.focus();
  el.setSelectionRange(selection.start, selection.end);
};

export interface MaskedInputProps {
  mask: string;
  placeholderChar?: string;
  formatCharacters?: FormatCharacters;
  value: string;
  onChange?: (e: FormEvent<HTMLInputElement>) => void;
  placeholder?: string;
  size?: number;
}

export class MaskedInput extends React.Component<MaskedInputProps> {
  mask: InputMask;
  input?: HTMLInputElement;

  constructor(props: MaskedInputProps) {
    super(props);

    const options: InputMaskProps = {
      pattern: this.props.mask,
      value: this.props.value,
      formatCharacters: this.props.formatCharacters || null,
    };

    if (this.props.placeholderChar) {
      options.placeholderChar = this.props.placeholderChar;
    }

    this.mask = new InputMask(options);
  }

  /* eslint-disable-next-line camelcase */
  UNSAFE_componentWillReceiveProps(nextProps: MaskedInputProps) {
    if (this.props.mask !== nextProps.mask && this.props.value !== nextProps.mask) {
      // if we get a new value and a new mask at the same time
      // check if the mask.value is still the initial value
      // - if so use the nextProps value
      // - otherwise the `this.mask` has a value for us (most likely from paste action)
      if (this.mask.getValue() === this.mask.emptyValue) {
        this.mask.setPattern(nextProps.mask, { value: nextProps.value });
      } else {
        this.mask.setPattern(nextProps.mask, { value: this.mask.getRawValue() });
      }
    } else if (this.props.mask !== nextProps.mask) {
      this.mask.setPattern(nextProps.mask, { value: this.mask.getRawValue() });
    } else if (this.props.value !== nextProps.value) {
      this.mask.setValue(nextProps.value);
    }
  }

  /* eslint-disable-next-line camelcase */
  UNSAFE_componentWillUpdate(nextProps: MaskedInputProps) {
    if (nextProps.mask !== this.props.mask) {
      this._updatePattern(nextProps);
    }
  }

  componentDidUpdate(prevProps: MaskedInputProps) {
    if (prevProps.mask !== this.props.mask && this.mask.selection.start) {
      this._updateInputSelection();
    }
  }

  _updatePattern(props: MaskedInputProps) {
    if (!this.input) return;

    this.mask.setPattern(props.mask, {
      value: this.mask.getRawValue(),
      selection: getSelection(this.input),
    });
  }

  _updateMaskSelection() {
    if (!this.input) return;
    this.mask.selection = getSelection(this.input);
  }

  _updateInputSelection() {
    if (!this.input) return;
    setSelection(this.input, this.mask.selection);
  }

  _onChange = (e: FormEvent<HTMLInputElement>) => {
    const maskValue = this.mask.getValue();
    const incomingValue = e.currentTarget.value;

    if (incomingValue !== maskValue) {
      // only modify mask if form contents actually changed
      this._updateMaskSelection();
      this.mask.setValue(incomingValue); // write the whole updated value into the mask
      e.currentTarget.value = this._getDisplayValue(); // update the form with pattern applied to the value
      this._updateInputSelection();
    }

    this.props.onChange?.(e);
  };

  _onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isUndo(e)) {
      e.preventDefault();

      if (this.mask.undo()) {
        e.currentTarget.value = this._getDisplayValue();
        this._updateInputSelection();
        this.props.onChange?.(e);
      }

      return;
    } else if (isRedo(e)) {
      e.preventDefault();

      if (this.mask.redo()) {
        e.currentTarget.value = this._getDisplayValue();
        this._updateInputSelection();
        this.props.onChange?.(e);
      }

      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      this._updateMaskSelection();

      if (this.mask.backspace()) {
        const value = this._getDisplayValue();
        e.currentTarget.value = value;

        if (value) {
          this._updateInputSelection();
        }

        this.props.onChange?.(e);
      }
    }
  };

  _onKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    // Ignore modified key presses
    // Ignore enter key to allow form submission
    if (e.metaKey || e.altKey || e.ctrlKey || e.key === 'Enter') {
      return;
    }

    e.preventDefault();
    this._updateMaskSelection();

    if (this.mask.input(e.key)) {
      e.currentTarget.value = this.mask.getValue();
      this._updateInputSelection();
      this.props.onChange?.(e);
    }
  };

  _onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    this._updateMaskSelection();

    // getData value needed for IE also works in FF & Chrome
    if (this.mask.paste(e.clipboardData.getData('Text'))) {
      e.currentTarget.value = this.mask.getValue();
      // Timeout needed for IE
      setTimeout(() => this._updateInputSelection(), 0);
      this.props.onChange?.(e);
    }
  };

  _getDisplayValue() {
    const value = this.mask.getValue();
    return value === this.mask.emptyValue ? '' : value;
  }

  _keyPressPropName() {
    return 'onKeyPress';
  }

  _getEventHandlers() {
    return {
      onChange: this._onChange,
      onKeyDown: this._onKeyDown,
      onPaste: this._onPaste,
      [this._keyPressPropName()]: this._onKeyPress,
    };
  }

  focus() {
    this.input?.focus();
  }

  blur() {
    this.input?.blur();
  }

  render() {
    const ref = (r: HTMLInputElement) => {
      this.input = r;
    };

    const maxLength = Number(this.mask.pattern?.length);
    const value = this._getDisplayValue();
    const eventHandlers = this._getEventHandlers();
    const { size = maxLength, placeholder = this.mask.emptyValue } = this.props;

    const { placeholderChar, formatCharacters, ...cleanedProps } = this.props;

    const inputProps = {
      ...cleanedProps,
      ...eventHandlers,
      ref,
      maxLength,
      value,
      size,
      placeholder,
    };

    return <input {...inputProps} />;
  }
}
