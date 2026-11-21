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
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";

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

/** DDMMYYYY that is a real, past date (e.g. not 31022020). */
export function isRealDob(dob) {
  if (!/^\d{8}$/.test(dob || "")) return false;
  const d = +dob.slice(0, 2), m = +dob.slice(2, 4), y = +dob.slice(4);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
      && y >= 1990 && date <= new Date();
}

/** Indian mobile number: 10 digits starting 6–9. */
export function isValidPhone(phone) {
  return /^[6-9]\d{9}$/.test(phone || "");
}

/** "MM-DD" birthday (for the birthday greeting) from a DDMMYYYY date of birth. */
export function birthdayFromDob(dob) {
  return /^\d{8}$/.test(dob || "") ? `${dob.slice(2, 4)}-${dob.slice(0, 2)}` : "";
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
    const cred = await signIn(primary, dob);
    // A leftover login with no profile (e.g. an old test account) must not
    // hide the real child's brother/sister login on the same phone.
    const profile = await getDoc(doc(db, "users", cred.user.uid));
    if (profile.exists()) return cred;
    await signOut(auth);
  } catch (e) {
    if (!CREDENTIAL_ERRORS.has(e.code)) throw e;
  }
  return await signIn(sibling, dob);
}
