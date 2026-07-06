import { notifications } from '@mantine/notifications';

/** Единый тост «Неверный код» для обоих мест ввода кода (join по коду
 * списка и привязка устройства) — раньше строка и вызов дублировались. */
export function notifyInvalidCode(): void {
  notifications.show({ color: 'red', message: 'Неверный код' });
}
