import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping send. Reset link for ${to}: ${resetUrl}`
    );
    return;
  }

  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "ChickensFarm <onboarding@resend.dev>",
    to,
    subject: "Slaptažodžio atkūrimas",
    html: `<p>Gavome prašymą atkurti jūsų slaptažodį.</p><p><a href="${resetUrl}">Spauskite čia, kad nustatytumėte naują slaptažodį</a></p><p>Nuoroda galioja 1 valandą. Jei šio prašymo nesiuntėte, ignoruokite šį laišką.</p>`,
  });
}
