/** The page's one h1 and its lead line, in the shared Urbanist family. */
export function AuthHeading({ title, body }: { title: string; body?: string }) {
  return (
    <div className="auth__heading">
      <h1 className="auth__h1">{title}</h1>
      {body ? <p className="auth__lead">{body}</p> : null}
    </div>
  );
}
