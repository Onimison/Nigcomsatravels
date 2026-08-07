import React from "react";

interface DatePickerProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function DatePicker({
  label,
  className = "",
  ...props
}: DatePickerProps) {
  return (
    <div className="flex flex-col gap-1">

      {label && (
        <label className="text-sm font-medium">
          {label}
        </label>
      )}

      <input
        type="date"
        className={`border rounded-lg px-3 py-2 ${className}`}
        {...props}
      />
    </div>
  );
}