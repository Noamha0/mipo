import type { Business } from '../../../lib/types';

/**
 * כל שלב באשף הוא גם מקטע בהגדרות. באשף — הכפתור הוא בסרגל התחתון
 * (form="step-form") ו-submitLabel ריק; בהגדרות — כפתור שמירה בתוך המקטע.
 */
export interface StepProps {
  business: Business | null;
  onSaved: (business: Business) => void;
  submitLabel?: string;
  formId?: string;
}
