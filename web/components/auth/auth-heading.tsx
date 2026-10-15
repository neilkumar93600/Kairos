export function AuthHeading({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mb-8 flex flex-col gap-2">
      <h1 className="text-2xl tracking-tight">{title}</h1>
      {body ? <p className="text-sm text-body">{body}</p> : null}
    </div>
  );
}
