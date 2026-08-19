import React from "react";

interface Column<T> {
  key: keyof T;
  title: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
}

export default function Table<T>({
  columns,
  data,
}: TableProps<T>) {
  return (
    <table className="w-full border-collapse">

      <thead>
        <tr className="bg-gray-100">
          {columns.map((column) => (
            <th
              
              key={String(column.key)}
              className="border p-3 text-left"
            >
              {column.title}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {data.map((row, index) => (
          <tr key={index}>
            {columns.map((column) => (
              <td
               
                key={String(column.key)}  
                className="border p-3"
              >
                {String(row[column.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}