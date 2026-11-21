/* ────────────────────────────────────────────────────────────
   Student login accounts

   Parents always sign in with  phone number + child's date of birth.
   Behind the scenes each child needs a unique login email:

     1st child on a phone number       9876543210@vaanavilvidyalaya.com
     brother / sister on same phone    9876543210_14062019@vaanavilvidyalaya.com
     twins (same phone AND same DOB)   9876543210_14062019_2@vaanavilvidyalaya.com

   The password is always the date of birth (DDMMYYYY).
   Twins log in to one twin's account and use "Switch" on the
   dashboard to reach the other (stored in users/{uid}.twins).
   ──────────────────────────────────────────────────────────── */
export const STUDENT_DOMAIN = "vaanavilvidyalaya.com";

/** Login emails a student may get, in the order they are assigned. */
export function studentLoginEmails(phone, dob, twinSlots = 3) {
  const list = [
    `${phone}@${STUDENT_DOMAIN}`,
    `${phone}_${dob}@${STUDENT_DOMAIN}`,
  ];
  for (let i = 2; i < 2 + twinSlots; i++) list.push(`${phone}_${dob}_${i}@${STUDENT_DOMAIN}`);
  return list;
}

const CREDENTIAL_ERRORS = new Set([
  "auth/invalid-credential",
  "auth/invalid-login-credentials",
  "auth/wrong-password",
  "auth/user-not-found",
]);

/** Sign a student in: tries the normal account, then the brother/sister account. */
export async function signInStudent(signIn, phone, dob) {
  const [primary, sibling] = studentLoginEmails(phone, dob);
  try {
    return await signIn(primary, dob);
  } catch (e) {
    if (!CREDENTIAL_ERRORS.has(e.code)) throw e;
    return await signIn(sibling, dob);
  }
}
