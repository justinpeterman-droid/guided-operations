"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { verifyCsrfToken } from "@/server/auth/csrf";
import {
  clearSessionCookie,
  getOrCreateDeviceId,
  networkIdentifierFromHeaders,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from "@/server/auth/http";
import { mutationRequestIsSameOrigin } from "@/server/auth/request-security";
import {
  getServerAuthService,
  isAuthServerConfigured,
} from "@/server/auth/server";

const loginSchema = z.object({
  employeeNumber: z.string().min(2).max(64),
  passcode: z.string().min(1).max(128),
});

const changePasscodeSchema = z
  .object({
    newPasscode: z.string().min(1).max(128),
    confirmPasscode: z.string().min(1).max(128),
    csrfToken: z.string().min(1).max(256),
  })
  .refine((value) => value.newPasscode === value.confirmPasscode, {
    message: "The new passcodes do not match.",
    path: ["confirmPasscode"],
  });

export interface LoginActionState {
  message: string;
}

export interface ChangePasscodeActionState {
  message: string;
}

export const initialLoginActionState: LoginActionState = { message: "" };
export const initialChangePasscodeActionState: ChangePasscodeActionState = {
  message: "",
};

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  if (!isAuthServerConfigured()) {
    return { message: "Secure sign-in is not configured in this environment." };
  }

  const parsed = loginSchema.safeParse({
    employeeNumber: formData.get("employeeNumber"),
    passcode: formData.get("passcode"),
  });
  if (!parsed.success) {
    return { message: "Enter your employee number and personal passcode." };
  }

  const environment = getAuthServerEnvironment();
  const requestHeaders = await headers();
  if (!mutationRequestIsSameOrigin(requestHeaders, environment.APP_ORIGIN)) {
    return { message: "The sign-in request could not be verified." };
  }

  const cookieStore = await cookies();
  const secure = environment.APP_ORIGIN.startsWith("https://");
  const deviceId = getOrCreateDeviceId(cookieStore, secure);

  let result;
  try {
    result = await getServerAuthService().signIn({
      employeeNumber: parsed.data.employeeNumber,
      passcode: parsed.data.passcode,
      deviceId,
      networkId: networkIdentifierFromHeaders(requestHeaders),
    });
  } catch {
    return { message: "Secure sign-in is temporarily unavailable." };
  }

  if (!result.success) {
    if (result.code === "rate-limited") {
      return {
        message: "Too many sign-in attempts. Try again after a short wait.",
      };
    }
    return { message: "Employee number or personal passcode was not accepted." };
  }

  setSessionCookie(cookieStore, result.sessionToken, secure);
  redirect(result.account.mustChangePasscode ? "/change-passcode" : "/");
}

export async function logoutAction(formData: FormData): Promise<void> {
  if (!isAuthServerConfigured()) {
    redirect("/");
  }

  const environment = getAuthServerEnvironment();
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const secure = environment.APP_ORIGIN.startsWith("https://");

  if (!mutationRequestIsSameOrigin(requestHeaders, environment.APP_ORIGIN)) {
    return;
  }

  const serializedSession = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const csrfToken = formData.get("csrfToken");
  if (!serializedSession || typeof csrfToken !== "string") {
    clearSessionCookie(cookieStore, secure);
    redirect("/");
  }

  const service = getServerAuthService();
  const session = await service.resolveSession(serializedSession, {
    rotate: false,
  });
  if (
    !session ||
    !verifyCsrfToken(
      csrfToken,
      session.sessionId,
      session.sessionSecret,
      environment.AUTH_CSRF_HMAC_KEY,
    )
  ) {
    return;
  }

  await service.signOut(serializedSession);
  clearSessionCookie(cookieStore, secure);
  redirect("/");
}

export async function changePasscodeAction(
  _previousState: ChangePasscodeActionState,
  formData: FormData,
): Promise<ChangePasscodeActionState> {
  if (!isAuthServerConfigured()) {
    return { message: "Secure account access is not configured." };
  }

  const parsed = changePasscodeSchema.safeParse({
    newPasscode: formData.get("newPasscode"),
    confirmPasscode: formData.get("confirmPasscode"),
    csrfToken: formData.get("csrfToken"),
  });
  if (!parsed.success) {
    return {
      message:
        parsed.error.issues[0]?.message ?? "Enter the new passcode twice.",
    };
  }

  const environment = getAuthServerEnvironment();
  const requestHeaders = await headers();
  if (!mutationRequestIsSameOrigin(requestHeaders, environment.APP_ORIGIN)) {
    return { message: "The passcode-change request could not be verified." };
  }

  const cookieStore = await cookies();
  const secure = environment.APP_ORIGIN.startsWith("https://");
  const serializedSession = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!serializedSession) {
    clearSessionCookie(cookieStore, secure);
    redirect("/");
  }

  const service = getServerAuthService();
  const session = await service.resolveSession(serializedSession, {
    rotate: false,
  });
  if (
    !session ||
    !verifyCsrfToken(
      parsed.data.csrfToken,
      session.sessionId,
      session.sessionSecret,
      environment.AUTH_CSRF_HMAC_KEY,
    )
  ) {
    return { message: "Your session could not be verified." };
  }

  const changed = await service.changePasscode(
    session,
    parsed.data.newPasscode,
  );
  if (!changed.success) {
    const message =
      changed.reason === "length"
        ? "Use a passcode between 10 and 64 characters."
        : changed.reason === "employee-number"
          ? "Your passcode cannot be your employee number."
          : changed.reason === "character-mix"
            ? "Use both letters and numbers in your passcode."
            : changed.reason === "conflict"
              ? "Your account changed while this request was being processed. Sign in again."
              : "Choose a less predictable passcode.";
    return { message };
  }

  clearSessionCookie(cookieStore, secure);
  redirect("/?passcodeChanged=1");
}
