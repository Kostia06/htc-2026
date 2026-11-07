const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const PHONE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const PROFILE = /(https?:\/\/)?(www\.)?(linkedin\.com\/in\/[\w-]+|github\.com\/[\w-]+)\/?/gi;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function anonymize(text: string, knownNames: string[] = []) {
  let out = text.replace(EMAIL, "[email]").replace(PROFILE, "[profile]").replace(PHONE, "[phone]");
  for (const name of knownNames.map((n) => n.trim()).filter(Boolean)) {
    out = out.replace(new RegExp(`\\b${escape(name)}\\b`, "gi"), "[name]");
  }
  return out;
}
