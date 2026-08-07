import React from "react";

interface CardProps {
  title?: string;
  children: React.ReactNode;
}

export default function Card({
  title,
  children,
}: CardProps) {
  return (
    <div className="bg-white rounded-xl shadow p-5">

      {title && (
        <h2 className="text-lg font-semibold mb-4">
          {title}
        </h2>
      )}

      {children}
    </div>
  );
}