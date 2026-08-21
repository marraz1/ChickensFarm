import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* the maskable icon keeps the bird inside a circular crop */}
          <Image
            src="/icon-maskable-512.png"
            alt=""
            width={72}
            height={72}
            priority
            className="mb-3 rounded-full shadow-sm ring-1 ring-black/5"
          />
          <h1 className="text-xl font-semibold">ChickensFarm</h1>
          <p className="text-sm text-muted-foreground">Paukštininkystės ūkio valdymas</p>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
