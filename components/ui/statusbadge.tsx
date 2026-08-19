import React from "react";
import { REQUEST_STATUS_COLORS } from "../../constants/requeststatus";

interface Props {
  status: keyof typeof REQUEST_STATUS_COLORS;
}

export default function StatusBadge({
  status,
}: Props) {
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${REQUEST_STATUS_COLORS[status]}`}
    >
      {status.toUpperCase()}
    </span>
  );
}