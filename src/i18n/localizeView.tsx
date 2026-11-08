import { cloneElement, isValidElement, type ReactNode, type ReactElement } from 'react';
import { getLearningLanguage } from './language';
import { translateText } from './translate';

/** Translate only presentation text. State, input values, IDs and saved records
 * keep their original values. Every student component applies this at its JSX boundary. */
export function localizeView<T extends ReactNode>(node: T): T {
  if (getLearningLanguage() === 'ko') return node;
  const visit = (value: ReactNode): ReactNode => {
    if (typeof value === 'string') return translateText(value);
    if (Array.isArray(value)) return value.map(visit);
    if (!isValidElement(value)) return value;
    const element = value as ReactElement<Record<string, unknown>>;
    const props = element.props;
    if (props.translate === 'no') return element;
    const updated: Record<string, unknown> = {};
    {
      for (const key of ['aria-label', 'aria-description', 'aria-valuetext', 'title', 'alt', 'placeholder']) {
        if (typeof props[key] === 'string') updated[key] = translateText(props[key]);
      }
      // Translating an option label must never change the submitted value.
      if (element.type === 'option' && props.value === undefined && typeof props.children === 'string') updated.value = props.children;
    }
    if ('children' in props && element.type !== 'textarea') updated.children = visit(props.children as ReactNode);
    return cloneElement(element, updated);
  };
  return visit(node) as T;
}
