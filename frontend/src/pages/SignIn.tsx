import { FormEvent, useState } from "react";
import { api, ApiError } from "../api/client";
import { Card, ErrorNote, Field } from "../components/ui";
import { useToast } from "../components/Toast";
import {
  ADMIN_PASSCODE,
  setAuthSession,
  type AdminSession,
  type AuthSession,
  type TeacherSession,
} from "../lib/authSession";
import { APP_LINKS } from "../lib/appLinks";

const CLASS_PRESETS = ["9-A", "9-B", "10-A", "10-B", "11-A", "11-B", "12-A", "12-B"];

type SignInMode = "teacher" | "admin";

interface FormErrors {
  name?: string;
  classManaged?: string;
  email?: string;
  passcode?: string;
}

function validateTeacher(
  name: string,
  classManaged: string,
  email: string,
): FormErrors {
  const errors: FormErrors = {};
  if (!name.trim()) errors.name = "Full name is required.";
  if (!classManaged.trim()) errors.classManaged = "Class is required.";
  if (!email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  return errors;
}

interface SignInProps {
  onSignedIn: (session: AuthSession) => void;
}

export function SignIn({ onSignedIn }: SignInProps) {
  const toast = useToast();

  const [mode, setMode] = useState<SignInMode>("teacher");
  const [name, setName] = useState("");
  const [classManaged, setClassManaged] = useState("");
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function switchMode(next: SignInMode) {
    setMode(next);
    setErrors({});
    setNetworkError(null);
    setPasscode("");
  }

  async function handleTeacherSubmit(e: FormEvent) {
    e.preventDefault();
    setNetworkError(null);

    const nextErrors = validateTeacher(name, classManaged, email);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const profile = await api.teacherSignIn({
        name: name.trim(),
        classManaged: classManaged.trim(),
        email: email.trim().toLowerCase(),
      });

      const session: TeacherSession = {
        role: "teacher",
        id: profile.id,
        name: profile.name,
        classManaged: profile.classManaged,
        email: profile.email,
        signedInAt: new Date().toISOString(),
      };
      setAuthSession(session);
      toast.success(`Welcome, ${profile.name}!`);
      onSignedIn(session);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setNetworkError(err.message);
        return;
      }

      // Backend offline or stale — sign in locally so the app still works.
      const session: TeacherSession = {
        role: "teacher",
        name: name.trim(),
        classManaged: classManaged.trim(),
        email: email.trim().toLowerCase(),
        signedInAt: new Date().toISOString(),
      };
      setAuthSession(session);
      toast.success(`Welcome, ${session.name}!`);
      onSignedIn(session);
    } finally {
      setSubmitting(false);
    }
  }

  function handleAdminSubmit(e: FormEvent) {
    e.preventDefault();
    setNetworkError(null);

    if (!passcode.trim()) {
      setErrors({ passcode: "Passcode is required." });
      return;
    }
    if (passcode.trim() !== ADMIN_PASSCODE) {
      setErrors({ passcode: "Incorrect passcode." });
      return;
    }

    const session: AdminSession = {
      role: "admin",
      signedInAt: new Date().toISOString(),
      name: name.trim() || undefined,
    };
    setAuthSession(session);
    toast.success("Admin access granted.");
    onSignedIn(session);
  }

  return (
    <div className="signin-page">
      <div className="signin-shell">
        <header className="signin-brand">
          <span className="brand-mark" aria-hidden>
            ✦
          </span>
          <div>
            <h1 className="signin-title">Gems Assist</h1>
            <p className="signin-group">Group 3 (NEPTUNE)</p>
            <p className="signin-members">
              Farhan Mohammed Rangrej · Kailas · Roselin
            </p>
            <p className="signin-tagline">Sign in to continue</p>
          </div>
        </header>

        <div className="role-tabs" role="tablist" aria-label="Sign-in role">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "teacher"}
            className={`role-tab${mode === "teacher" ? " active" : ""}`}
            onClick={() => switchMode("teacher")}
          >
            Teacher
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "admin"}
            className={`role-tab${mode === "admin" ? " active" : ""}`}
            onClick={() => switchMode("admin")}
          >
            Admin
          </button>
        </div>

        {mode === "teacher" ? (
          <Card
            title="Teacher sign-in"
            subtitle="Access grading, labs, substitution, and more."
            className="signin-card"
          >
            <form onSubmit={handleTeacherSubmit} noValidate>
              <Field label="Full name" htmlFor="teacher-name">
                <input
                  id="teacher-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder="e.g. Ms. Priya Sharma"
                  autoComplete="name"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "teacher-name-error" : undefined}
                />
                {errors.name && (
                  <span id="teacher-name-error" className="field-error" role="alert">
                    {errors.name}
                  </span>
                )}
              </Field>

              <Field
                label="Class managed"
                hint="Grade and section you teach."
                htmlFor="teacher-class"
              >
                <input
                  id="teacher-class"
                  type="text"
                  list="class-presets"
                  value={classManaged}
                  onChange={(e) => {
                    setClassManaged(e.target.value);
                    if (errors.classManaged) {
                      setErrors((prev) => ({ ...prev, classManaged: undefined }));
                    }
                  }}
                  placeholder="e.g. 11-A"
                  autoComplete="off"
                  aria-invalid={!!errors.classManaged}
                  aria-describedby={
                    errors.classManaged ? "teacher-class-error" : undefined
                  }
                />
                <datalist id="class-presets">
                  {CLASS_PRESETS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                {errors.classManaged && (
                  <span id="teacher-class-error" className="field-error" role="alert">
                    {errors.classManaged}
                  </span>
                )}
              </Field>

              <Field label="Email" htmlFor="teacher-email">
                <input
                  id="teacher-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder="you@school.edu"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "teacher-email-error" : undefined}
                />
                {errors.email && (
                  <span id="teacher-email-error" className="field-error" role="alert">
                    {errors.email}
                  </span>
                )}
              </Field>

              {networkError && <ErrorNote>{networkError}</ErrorNote>}

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={submitting}
              >
                {submitting ? "Signing in…" : "Sign in as teacher"}
              </button>
            </form>
          </Card>
        ) : (
          <Card
            title="Admin access"
            subtitle="Owner dashboard — manage lab bookings and platform settings."
            className="signin-card"
          >
            <form onSubmit={handleAdminSubmit} noValidate>
              <Field
                label="Display name (optional)"
                htmlFor="admin-name"
                hint="Shown in the sidebar after sign-in."
              >
                <input
                  id="admin-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. School Admin"
                  autoComplete="name"
                />
              </Field>

              <Field label="Admin passcode" htmlFor="admin-passcode">
                <input
                  id="admin-passcode"
                  type="password"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    if (errors.passcode) {
                      setErrors((prev) => ({ ...prev, passcode: undefined }));
                    }
                  }}
                  placeholder="Enter owner passcode"
                  autoComplete="off"
                  aria-invalid={!!errors.passcode}
                  aria-describedby={errors.passcode ? "admin-passcode-error" : undefined}
                />
                {errors.passcode && (
                  <span id="admin-passcode-error" className="field-error" role="alert">
                    {errors.passcode}
                  </span>
                )}
              </Field>

              <button type="submit" className="btn btn-primary btn-block">
                Enter admin dashboard
              </button>
            </form>
          </Card>
        )}

        <p className="signin-footnote">
          {mode === "teacher"
            ? "Your profile is saved locally and synced to the platform."
            : "Admin session is stored locally on this device."}
        </p>

        <p className="signin-links">
          <a href={APP_LINKS.live} target="_blank" rel="noreferrer">
            Live app (any device)
          </a>
          {" · "}
          <a href={APP_LINKS.local}>Local :5173</a>
          {" · "}
          <a href={APP_LINKS.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </p>
        <p className="signin-share-hint">
          Public share link: run <code>{APP_LINKS.shareCommand}</code> in the project folder
        </p>
      </div>
    </div>
  );
}
