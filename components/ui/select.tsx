import React from "react";

interface Option {
  label: string;
  value: string;
}

interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Option[];
  label?: string;
}

export default function Select({
  label,
  options,
  className = "",
  ...props
}: SelectProps) {
  return (
    <div className="flex flex-col gap-1">

      {label && (
        <label className="text-sm font-medium">
          {label}
        </label>
      )}

      <select
        className={`border rounded-lg px-3 py-2 ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}