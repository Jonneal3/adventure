"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

import { ModelWithSamples } from "@/types";

type ModelsTableProps = {
  models: ModelWithSamples[];
};

export default function ModelsTable({ models }: ModelsTableProps) {
  return (
    <div className="rounded-md border">
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {models?.map((model) => (
            <TableRow key={model.id} className="cursor-pointer h-16">
              <TableCell className="font-medium">{model.name}</TableCell>
              <TableCell>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  model.status === 'active' 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                }`}>
                  {model.status === 'active' ? "Active" : "Inactive"}
                </span>
              </TableCell>
              <TableCell>{model.provider}</TableCell>
              <TableCell>{model.model_id}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
