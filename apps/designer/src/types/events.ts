import { ChangeEvent, MouseEvent } from 'react';

// Common event types
export type InputChangeEvent = ChangeEvent<HTMLInputElement>;
export type TextAreaChangeEvent = ChangeEvent<HTMLTextAreaElement>;
export type ButtonClickEvent = MouseEvent<HTMLButtonElement>;
export type DivClickEvent = MouseEvent<HTMLDivElement>;

// Form event types
export type FormSubmitEvent = React.FormEvent<HTMLFormElement>;

// Generic event handler types
export type InputChangeHandler = (e: InputChangeEvent) => void;
export type TextAreaChangeHandler = (e: TextAreaChangeEvent) => void;
export type ButtonClickHandler = (e: ButtonClickEvent) => void;
export type DivClickHandler = (e: DivClickEvent) => void;
export type FormSubmitHandler = (e: FormSubmitEvent) => void; 