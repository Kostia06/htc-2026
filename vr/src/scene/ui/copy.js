// Words the 3D panels show, kept apart from the JSX so they can be tested.

// The API hands back the company as a slug ("shopify", "arc-teryx") when the
// phone launched by slug; show it as a name.
export function companyName(company) {
  const value = company?.trim()
  if (!value) return ''
  if (!/^[a-z0-9-]+$/.test(value)) return value
  return value
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** "Product Designer at Shopify", or a fallback when the phone sent neither. */
export function practiceLine(meta) {
  const role = meta?.role?.trim()
  const company = companyName(meta?.company)
  if (role && company) return `${role} at ${company}`
  return role || company || ''
}
