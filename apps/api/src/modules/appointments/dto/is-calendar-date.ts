import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

/** Strict Gregorian calendar-date validation for Nairobi wall-clock inputs. */
@ValidatorConstraint({ name: 'isCalendarDate', async: false })
export class IsCalendarDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    return (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    );
  }

  defaultMessage(args?: ValidationArguments): string {
    return `${args?.property ?? 'date'} must be a valid YYYY-MM-DD calendar date`;
  }
}

export function IsCalendarDate(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options: validationOptions,
      validator: IsCalendarDateConstraint,
    });
  };
}
