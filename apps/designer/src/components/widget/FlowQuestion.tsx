"use client";

import { FlowQuestion as FlowQuestionType } from '@/types/flow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FlowQuestionProps {
  question: FlowQuestionType;
  value: any;
  onChange: (value: any) => void;
}

export function FlowQuestion({ question, value, onChange }: FlowQuestionProps) {
  const handleChange = (newValue: any) => {
    onChange(newValue);
  };

  switch (question.type) {
    case 'text':
      return (
        <div className="space-y-2">
          <Label htmlFor={question.id}>
            {question.label}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {question.description && (
            <p className="text-xs text-muted-foreground">{question.description}</p>
          )}
          <Input
            id={question.id}
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={question.placeholder}
            required={question.required}
          />
        </div>
      );

    case 'textarea':
      return (
        <div className="space-y-2">
          <Label htmlFor={question.id}>
            {question.label}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {question.description && (
            <p className="text-xs text-muted-foreground">{question.description}</p>
          )}
          <Textarea
            id={question.id}
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={question.placeholder}
            required={question.required}
            rows={4}
          />
        </div>
      );

    case 'select':
      return (
        <div className="space-y-2">
          <Label htmlFor={question.id}>
            {question.label}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {question.description && (
            <p className="text-xs text-muted-foreground">{question.description}</p>
          )}
          <Select value={value || ''} onValueChange={handleChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case 'multi-select':
      return (
        <div className="space-y-2">
          <Label>
            {question.label}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {question.description && (
            <p className="text-xs text-muted-foreground">{question.description}</p>
          )}
          <div className="space-y-2">
            {question.options?.map((option) => {
              const selectedValues = Array.isArray(value) ? value : [];
              const isChecked = selectedValues.includes(option.value);
              return (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${question.id}-${option.value}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      const newValues = checked
                        ? [...selectedValues, option.value]
                        : selectedValues.filter((v) => v !== option.value);
                      handleChange(newValues);
                    }}
                  />
                  <Label
                    htmlFor={`${question.id}-${option.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
      );

    case 'number':
      return (
        <div className="space-y-2">
          <Label htmlFor={question.id}>
            {question.label}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {question.description && (
            <p className="text-xs text-muted-foreground">{question.description}</p>
          )}
          <Input
            id={question.id}
            type="number"
            value={value || ''}
            onChange={(e) => handleChange(Number(e.target.value))}
            placeholder={question.placeholder}
            required={question.required}
            min={question.min}
            max={question.max}
            step={question.step}
          />
        </div>
      );

    case 'boolean':
      return (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={question.id}
              checked={value || false}
              onCheckedChange={(checked) => handleChange(checked)}
            />
            <Label htmlFor={question.id} className="cursor-pointer">
              {question.label}
              {question.required && <span className="text-destructive ml-1">*</span>}
            </Label>
          </div>
          {question.description && (
            <p className="text-xs text-muted-foreground ml-6">{question.description}</p>
          )}
        </div>
      );

    case 'color':
      return (
        <div className="space-y-2">
          <Label htmlFor={question.id}>
            {question.label}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {question.description && (
            <p className="text-xs text-muted-foreground">{question.description}</p>
          )}
          <div className="flex gap-2">
            <Input
              type="color"
              value={value || '#000000'}
              onChange={(e) => handleChange(e.target.value)}
              className="w-16 h-10"
            />
            <Input
              value={value || '#000000'}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="#000000"
              className="flex-1"
            />
          </div>
        </div>
      );

    default:
      return (
        <div className="space-y-2">
          <Label>{question.label}</Label>
          <p className="text-xs text-muted-foreground">
            Question type "{question.type}" is not yet implemented.
          </p>
        </div>
      );
  }
}
