const formatter = new Intl.NumberFormat("id-ID");
const MAX_DIGITS = 12;

export function formatNumber(value) {
  return formatter.format(Number(value) || 0);
}

export function parseMoney(text) {
  return Number(String(text).replace(/\D/g, "")) || 0;
}

export function setMoney(input, value) {
  const number = Number(value) || 0;
  input.value = number > 0 ? formatter.format(number) : "";
}

export function attachMoney(input) {
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";

  input.addEventListener("input", () => {
    const caret = input.selectionStart ?? input.value.length;
    const digitsBeforeCaret = input.value.slice(0, caret).replace(/\D/g, "").length;
    const digits = input.value.replace(/\D/g, "").slice(0, MAX_DIGITS);

    input.value = digits ? formatter.format(Number(digits)) : "";

    let position = 0;
    let seen = 0;
    while (position < input.value.length && seen < digitsBeforeCaret) {
      if (/\d/.test(input.value[position])) seen += 1;
      position += 1;
    }
    input.setSelectionRange(position, position);
  });

  return input;
}