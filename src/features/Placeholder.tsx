export default function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <main className="center-card">
      <h1>{title}</h1>
      <p className="muted">{note}</p>
    </main>
  );
}
