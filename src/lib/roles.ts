/** Common MBA placement roles offered under "Prepare for a role" (no JD needed). */
export type RoleInfo = { slug: string; name: string; blurb: string };

export const ROLES: RoleInfo[] = [
  { slug: "product-manager", name: "Product Manager", blurb: "Product sense, metrics, prioritisation, execution" },
  { slug: "business-analyst", name: "Business Analyst", blurb: "SQL and Excel, problem solving, stakeholder needs" },
  { slug: "management-consultant", name: "Management Consultant", blurb: "Case interviews, frameworks, structured thinking" },
  { slug: "account-manager", name: "Sales and Account Manager", blurb: "Territory and key accounts, targets, negotiation" },
  { slug: "marketing-manager", name: "Brand and Marketing Manager", blurb: "Consumer insight, 4Ps, campaigns, brand health" },
  { slug: "financial-analyst", name: "Financial Analyst", blurb: "Valuation, financial statements, modelling" },
  { slug: "operations-manager", name: "Operations and Supply Chain", blurb: "Process, inventory, logistics, cost and quality" },
  { slug: "hr-manager", name: "HR and People Manager", blurb: "Talent, performance, culture, employee relations" },
];

export const roleBySlug = (slug: string) => ROLES.find((r) => r.slug === slug) ?? null;

/** A listed role, or one the user typed ("/role/custom?name=…"). */
export function resolveRole(slug: string, name?: string | null): RoleInfo | null {
  const listed = roleBySlug(slug);
  if (listed) return listed;
  const typed = (name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  return slug === "custom" && typed ? { slug: "custom", name: typed, blurb: "" } : null;
}
