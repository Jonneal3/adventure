export default function DesignerInstancesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-transparent">
      <main>
        {children}
      </main>
    </div>
  );
} 
