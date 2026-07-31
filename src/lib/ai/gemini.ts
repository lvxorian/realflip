/**
 * Sdílená konfigurace Gemini modelu.
 *
 * Model lze přepínat přes env `GEMINI_MODEL` (výchozí `gemini-flash-latest`).
 * Pozn.: `gemini-2.5-flash` byl pro nové free tier účty zrušen (HTTP 404),
 * proto se používá alias `gemini-flash-latest`, který míří na aktuální stabilní model.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
