import AdSlot from "@/components/AdSlot";
import PrototypeNote from "@/components/PrototypeNote";

export default function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}

      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          padding: "0 10px 14px",
        }}
      >
        <AdSlot />
        <PrototypeNote />
      </div>
    </>
  );
}