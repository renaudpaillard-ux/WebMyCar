import { forwardRef, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import DatePicker from "react-datepicker";
import { fr } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

interface DatePickerFieldProps {
  id: string;
  value: string | null;
  onChange: (nextValue: string | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
  required?: boolean;
}

interface DateInputButtonProps {
  value?: string;
  onClick?: () => void;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

function parseIsoDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const monthIndex = Number.parseInt(match[2], 10) - 1;
  const day = Number.parseInt(match[3], 10);
  const date = new Date(year, monthIndex, day);

  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== monthIndex
    || date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayDate(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function parseDisplayDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseIsoDate(trimmed);
  }

  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const day = Number.parseInt(match[1], 10);
  const monthIndex = Number.parseInt(match[2], 10) - 1;
  const year = Number.parseInt(match[3], 10);
  const date = new Date(year, monthIndex, day);

  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== monthIndex
    || date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

const DateInputButton = forwardRef<HTMLInputElement, DateInputButtonProps>(function DateInputButton(
  { value, onClick, onChange, onBlur, placeholder = "JJ/MM/AAAA", autoFocus = false },
  ref,
) {
  return (
    <input
      ref={ref}
      type="text"
      className="form-input date-picker-field__input"
      value={value ?? ""}
      onClick={onClick}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      autoFocus={autoFocus}
    />
  );
});

export default function DatePickerField({
  id,
  value,
  onChange,
  placeholder = "JJ/MM/AAAA",
  autoFocus = false,
  required = false,
}: DatePickerFieldProps) {
  const [rawInputValue, setRawInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);

  function closePicker() {
    setIsOpen(false);
  }

  return (
    <DatePicker
      id={id}
      open={isOpen}
      selected={selectedDate}
      onChange={(date: Date | null) => {
        onChange(date ? toIsoDate(date) : null);
        setRawInputValue("");
        closePicker();
      }}
      onChangeRaw={(event) => {
        const nextValue = (event?.currentTarget as HTMLInputElement | null)?.value ?? "";
        setRawInputValue(nextValue);
        const parsed = parseDisplayDate(nextValue);
        if (parsed) {
          onChange(toIsoDate(parsed));
        } else if (!nextValue.trim() && !required) {
          onChange(null);
        }
      }}
      onInputClick={() => setIsOpen(true)}
      onFocus={() => setIsOpen(true)}
      onClickOutside={closePicker}
      onSelect={() => setRawInputValue("")}
      onBlur={() => {
        if (!rawInputValue.trim()) {
          if (!required) {
            onChange(null);
          }
          return;
        }

        const parsed = parseDisplayDate(rawInputValue);
        if (parsed) {
          onChange(toIsoDate(parsed));
        }
      }}
      customInput={<DateInputButton placeholder={placeholder} autoFocus={autoFocus} />}
      dateFormat="dd/MM/yyyy"
      locale={fr}
      placeholderText={placeholder}
      calendarStartDay={1}
      showPopperArrow={false}
      fixedHeight
      className="date-picker-field"
      wrapperClassName="date-picker-field__wrapper"
      popperClassName="date-picker-field__popper"
      shouldCloseOnSelect
      formatWeekDay={(day) => day.slice(0, 1).toUpperCase()}
      renderCustomHeader={({ date, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
        <div className="date-picker-field__header">
          <button
            type="button"
            className="date-picker-field__nav"
            onClick={decreaseMonth}
            disabled={prevMonthButtonDisabled}
            aria-label="Mois précédent"
          >
            ‹
          </button>
          <div className="date-picker-field__header-label" aria-live="polite">
            {date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </div>
          <button
            type="button"
            className="date-picker-field__nav"
            onClick={increaseMonth}
            disabled={nextMonthButtonDisabled}
            aria-label="Mois suivant"
          >
            ›
          </button>
        </div>
      )}
    >
      <div className="date-picker-field__footer">
        <button
          type="button"
          className="date-picker-field__action"
          onClick={() => {
            setRawInputValue("");
            if (!required) {
              onChange(null);
            }
            closePicker();
          }}
          disabled={required}
        >
          Effacer
        </button>
        <button
          type="button"
          className="date-picker-field__action"
          onClick={() => {
            setRawInputValue("");
            onChange(toIsoDate(getTodayDate()));
            closePicker();
          }}
        >
          Aujourd&apos;hui
        </button>
      </div>
    </DatePicker>
  );
}
