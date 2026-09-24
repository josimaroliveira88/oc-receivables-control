// Keeps Zod's built-in validation messages in the same PT-BR language as the
// application-owned validation messages.
const translateZodMessage = (message) => {
  if (message === 'Required') return 'Campo obrigatório';
  if (message === 'Invalid uuid') return 'Valor inválido';
  if (message === 'Invalid input') return 'Valor inválido';
  if (message === 'Expected integer, received float') {
    return 'Valor inválido';
  }

  const stringLengthMatch = message.match(
    /^String must contain (at least|at most) (\d+) character/,
  );
  if (stringLengthMatch) {
    return stringLengthMatch[1] === 'at least'
      ? `O texto deve ter pelo menos ${stringLengthMatch[2]} caracteres`
      : `O texto deve ter no máximo ${stringLengthMatch[2]} caracteres`;
  }

  const numberRangeMatch = message.match(
    /^Number must be (greater than or equal to|less than or equal to|greater than|less than) (.+)$/,
  );
  if (numberRangeMatch) {
    const comparison = {
      'greater than or equal to': 'maior ou igual a',
      'less than or equal to': 'menor ou igual a',
      'greater than': 'maior que',
      'less than': 'menor que',
    }[numberRangeMatch[1]];
    return `O número deve ser ${comparison} ${numberRangeMatch[2]}`;
  }

  // Zod emits "element(s)"; accept "item" too for robustness.
  const arrayLengthMatch = message.match(
    /^Array must contain (at least|at most) (\d+) (?:element|item)/,
  );
  if (arrayLengthMatch) {
    const count = Number(arrayLengthMatch[2]);
    const noun = count === 1 ? 'item' : 'itens';
    return arrayLengthMatch[1] === 'at least'
      ? `A lista deve ter pelo menos ${count} ${noun}`
      : `A lista deve ter no máximo ${count} ${noun}`;
  }

  if (message.startsWith('Invalid literal')) return 'Valor inválido';
  if (message.startsWith('Unrecognized key')) {
    return 'Campo não reconhecido';
  }
  if (message === 'Received NaN') return 'Número inválido';

  const typeMatch = message.match(/^Expected (.+), received (.+)$/);
  if (typeMatch) {
    const types = {
      string: 'texto',
      number: 'número',
      boolean: 'booleano',
      object: 'objeto',
      array: 'lista',
      date: 'data',
    };
    const expected = types[typeMatch[1]] || typeMatch[1];
    const received = types[typeMatch[2]] || typeMatch[2];
    return `Esperado ${expected}, recebido ${received}`;
  }

  if (message.startsWith('Invalid enum value')) return 'Valor inválido';
  return message;
};

const translateZodIssues = (issues = []) =>
  issues.map((issue) => ({
    ...issue,
    message: translateZodMessage(issue.message),
  }));

export { translateZodIssues, translateZodMessage };
