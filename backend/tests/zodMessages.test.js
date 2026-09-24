import { z } from 'zod';
import {
  translateZodMessage,
  translateZodIssues,
} from '../src/utils/zodMessages.js';

// Collects the raw Zod messages a schema produces for an invalid payload.
const rawMessages = (schema, value) => {
  const result = schema.safeParse(value);
  if (result.success) throw new Error('Expected the payload to be invalid');
  return result.error.errors.map((issue) => issue.message);
};

describe('zodMessages util', () => {
  describe('translateZodMessage', () => {
    it('translates array length messages emitted as "element(s)"', () => {
      const [message] = rawMessages(z.array(z.string()).min(1), []);

      expect(message).toBe('Array must contain at least 1 element(s)');
      expect(translateZodMessage(message)).toBe(
        'A lista deve ter pelo menos 1 item',
      );
    });

    it('pluralizes the array item noun for counts greater than one', () => {
      const [message] = rawMessages(z.array(z.string()).max(2), [
        'a',
        'b',
        'c',
      ]);

      expect(translateZodMessage(message)).toBe(
        'A lista deve ter no máximo 2 itens',
      );
    });

    it('translates the remaining common Zod built-ins', () => {
      expect(translateZodMessage('Required')).toBe('Campo obrigatório');
      expect(translateZodMessage('Invalid uuid')).toBe('Valor inválido');
      expect(
        translateZodMessage('String must contain at least 3 character(s)'),
      ).toBe('O texto deve ter pelo menos 3 caracteres');
      expect(
        translateZodMessage('Number must be greater than or equal to 5'),
      ).toBe('O número deve ser maior ou igual a 5');
      expect(translateZodMessage('Expected string, received number')).toBe(
        'Esperado texto, recebido número',
      );
    });

    it('returns the original message when it is not recognized', () => {
      expect(translateZodMessage('Some unmapped message')).toBe(
        'Some unmapped message',
      );
    });
  });

  describe('translateZodIssues', () => {
    it('preserves the issue shape and replaces only the message', () => {
      const result = z
        .object({ rescues: z.array(z.string()).min(1) })
        .safeParse({
          rescues: [],
        });

      const [issue] = translateZodIssues(result.error.errors);

      expect(issue).toMatchObject({
        code: 'too_small',
        path: ['rescues'],
        message: 'A lista deve ter pelo menos 1 item',
      });
    });
  });
});
