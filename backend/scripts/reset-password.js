// scripts/reset-password.js — set a new password for an existing CRM user.
//
// Run on the server: `npm run reset-password`. Prompts for the user's email
// and a new password (input is hidden). Only changes that user's password;
// existing sessions for the user stop working (password fingerprint changes).
// Non-interactive: set RESET_EMAIL and RESET_PASSWORD in the environment.
import readline from "node:readline";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";
import { validate } from "../utils/validate.js";
import { PASSWORD_RULE } from "../middleware/auth.js";

const ask = (question, hidden = false) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : s.replace(/[^\r\n]/g, "*"));
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });

const main = async () => {
  const email = process.env.RESET_EMAIL || (await ask("User email: "));
  const { email: normalized } = validate({ email }, { email: { type: "email", required: true } });
  const user = await prisma.crmUser.findUnique({ where: { email: normalized } });
  if (!user) throw new Error(`No CRM user with email ${normalized}.`);

  let password = process.env.RESET_PASSWORD;
  if (!password) {
    password = await ask("New password (min 10 chars, letters + numbers): ", true);
    if ((await ask("Confirm new password: ", true)) !== password) throw new Error("Passwords do not match.");
  }
  const data = validate({ password }, { password: PASSWORD_RULE });

  await prisma.crmUser.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(data.password, 12) },
  });
  console.log(`Password updated for ${user.email} (${user.role}) ✅  You can now sign in to the CRM.`);
  if (!user.isActive) console.log("Note: this account is deactivated — an admin must reactivate it before it can sign in.");
};

main()
  .catch((err) => {
    const fields = err.details ? ` ${Object.entries(err.details).map(([k, v]) => `${k}: ${v}`).join("; ")}` : "";
    console.error(`Could not reset password ❌ ${err.message}${fields}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
