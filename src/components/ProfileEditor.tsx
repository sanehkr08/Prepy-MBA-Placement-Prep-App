"use client";

import { Plus, Trash2 } from "lucide-react";
import type { Profile } from "@/lib/schemas";
import { fieldInput, fieldLabel } from "./ui";

const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

function SmallButton({ onClick, children, label }: { onClick: () => void; children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white/70 px-4 text-[13px] font-semibold hover:bg-white"
    >
      {children}
    </button>
  );
}

/** Every parsed field is editable before the profile is saved (US-02). */
export function ProfileEditor({ value, onChange }: { value: Profile; onChange: (p: Profile) => void }) {
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => onChange({ ...value, [k]: v });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pf-name" className={fieldLabel}>
            Name
          </label>
          <input id="pf-name" className={fieldInput} value={value.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pf-headline" className={fieldLabel}>
            Headline
          </label>
          <input
            id="pf-headline"
            className={fieldInput}
            value={value.headline}
            onChange={(e) => set("headline", e.target.value)}
          />
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${fieldLabel} mb-1.5`}>Education</legend>
        {value.education.map((ed, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 rounded-2xl bg-white/50 p-2 sm:grid-cols-[1.2fr_1.2fr_0.7fr_auto]">
            <input
              aria-label={`Education ${i + 1} degree`}
              placeholder="Degree"
              className={fieldInput}
              value={ed.degree}
              onChange={(e) => set("education", value.education.map((x, j) => (j === i ? { ...x, degree: e.target.value } : x)))}
            />
            <input
              aria-label={`Education ${i + 1} institution`}
              placeholder="Institution"
              className={fieldInput}
              value={ed.institution}
              onChange={(e) =>
                set("education", value.education.map((x, j) => (j === i ? { ...x, institution: e.target.value } : x)))
              }
            />
            <input
              aria-label={`Education ${i + 1} years`}
              placeholder="Years"
              className={fieldInput}
              value={ed.years}
              onChange={(e) => set("education", value.education.map((x, j) => (j === i ? { ...x, years: e.target.value } : x)))}
            />
            <SmallButton label={`Remove education ${i + 1}`} onClick={() => set("education", value.education.filter((_, j) => j !== i))}>
              <Trash2 size={16} aria-hidden />
            </SmallButton>
          </div>
        ))}
        <div>
          <SmallButton label="Add education" onClick={() => set("education", [...value.education, { degree: "", institution: "", years: "" }])}>
            <Plus size={16} aria-hidden /> Add education
          </SmallButton>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${fieldLabel} mb-1.5`}>Experience</legend>
        {value.experience.map((ex, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-2xl bg-white/50 p-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_0.8fr_auto]">
              <input
                aria-label={`Experience ${i + 1} title`}
                placeholder="Title"
                className={fieldInput}
                value={ex.title}
                onChange={(e) => set("experience", value.experience.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              />
              <input
                aria-label={`Experience ${i + 1} company`}
                placeholder="Company"
                className={fieldInput}
                value={ex.company}
                onChange={(e) => set("experience", value.experience.map((x, j) => (j === i ? { ...x, company: e.target.value } : x)))}
              />
              <input
                aria-label={`Experience ${i + 1} dates`}
                placeholder="Dates"
                className={fieldInput}
                value={ex.dates}
                onChange={(e) => set("experience", value.experience.map((x, j) => (j === i ? { ...x, dates: e.target.value } : x)))}
              />
              <SmallButton
                label={`Remove experience ${i + 1}`}
                onClick={() => set("experience", value.experience.filter((_, j) => j !== i))}
              >
                <Trash2 size={16} aria-hidden />
              </SmallButton>
            </div>
            <textarea
              aria-label={`Experience ${i + 1} bullet points, one per line`}
              placeholder="Bullet points, one per line"
              rows={Math.max(3, ex.bullets.length + 1)}
              className={fieldInput}
              value={ex.bullets.join("\n")}
              onChange={(e) =>
                set(
                  "experience",
                  value.experience.map((x, j) => (j === i ? { ...x, bullets: e.target.value.split("\n") } : x)),
                )
              }
              onBlur={(e) =>
                set("experience", value.experience.map((x, j) => (j === i ? { ...x, bullets: lines(e.target.value) } : x)))
              }
            />
          </div>
        ))}
        <div>
          <SmallButton
            label="Add experience"
            onClick={() => set("experience", [...value.experience, { title: "", company: "", dates: "", bullets: [] }])}
          >
            <Plus size={16} aria-hidden /> Add experience
          </SmallButton>
        </div>
      </fieldset>

      {(
        [
          ["achievements", "Achievements (one per line)"],
          ["skills", "Skills (one per line)"],
          ["interests", "Interests (one per line)"],
        ] as const
      ).map(([key, label]) => (
        <div key={key} className="flex flex-col gap-1.5">
          <label htmlFor={`pf-${key}`} className={fieldLabel}>
            {label}
          </label>
          <textarea
            id={`pf-${key}`}
            rows={Math.max(2, value[key].length + 1)}
            className={fieldInput}
            value={value[key].join("\n")}
            onChange={(e) => set(key, e.target.value.split("\n"))}
            onBlur={(e) => set(key, lines(e.target.value))}
          />
        </div>
      ))}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="pf-projects" className={fieldLabel}>
          Projects (one per line, “Name: description”)
        </label>
        <textarea
          id="pf-projects"
          rows={Math.max(2, value.projects.length + 1)}
          className={fieldInput}
          value={value.projects.map((p) => (p.description ? `${p.name}: ${p.description}` : p.name)).join("\n")}
          onChange={(e) =>
            set(
              "projects",
              e.target.value.split("\n").map((l) => {
                const k = l.indexOf(":");
                return k === -1 ? { name: l, description: "" } : { name: l.slice(0, k), description: l.slice(k + 1).trimStart() };
              }),
            )
          }
          onBlur={() => set("projects", value.projects.filter((p) => p.name.trim() || p.description.trim()))}
        />
      </div>
    </div>
  );
}

/** Remove empty rows before saving. */
export function cleanProfile(p: Profile): Profile {
  return {
    ...p,
    education: p.education.filter((e) => e.degree.trim() || e.institution.trim()),
    experience: p.experience
      .filter((e) => e.title.trim() || e.company.trim())
      .map((e) => ({ ...e, bullets: e.bullets.map((b) => b.trim()).filter(Boolean) })),
    projects: p.projects.filter((x) => x.name.trim() || x.description.trim()),
    skills: p.skills.map((s) => s.trim()).filter(Boolean),
    achievements: p.achievements.map((s) => s.trim()).filter(Boolean),
    interests: p.interests.map((s) => s.trim()).filter(Boolean),
  };
}
