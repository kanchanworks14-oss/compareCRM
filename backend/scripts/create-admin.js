// scripts/create-admin.js — one-time setup of the first Super Admin.
//
// Run on the server: `npm run create-admin`. Prompts for email and password
// (password input is hidden). Refuses to run if an active admin already
// exists — further users are created by an admin from the Sales Team page.
// Non-interactive: set ADMIN_EMAIL and ADMIN_PASSWORD in the environment.
import readline from "node:readline";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";
import { validate } from "../utils/validate.js";
import { PASSWORD_RULE, ROLES } from "../middleware/auth.js";

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
  const existing = await prisma.crmUser.count({ where: { role: ROLES.ADMIN, isActive: true } });
  if (existing > 0) {
    console.log("An active Super Admin already exists. Sign in and add users from the Sales Team page.");
    return;
  }

  const email = process.env.ADMIN_EMAIL || (await ask("Admin email: "));
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await ask("Password (min 10 chars, letters + numbers): ", true);
    if ((await ask("Confirm password: ", true)) !== password) throw new Error("Passwords do not match.");
  }

  const data = validate({ email, password }, { email: { type: "email", required: true }, password: PASSWORD_RULE });
  if (await prisma.crmUser.findUnique({ where: { email: data.email } })) {
    throw new Error("A CRM user with that email already exists. Ask an admin to change its role instead.");
  }
  await prisma.crmUser.create({
    data: { email: data.email, role: ROLES.ADMIN, password: await bcrypt.hash(data.password, 12) },
  });
  console.log(`Super Admin created for ${data.email} ✅  You can now sign in to the CRM.`);
};

main()
  .catch((err) => {
    const fields = err.details ? ` ${Object.entries(err.details).map(([k, v]) => `${k}: ${v}`).join("; ")}` : "";
    console.error(`Could not create admin ❌ ${err.message}${fields}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
