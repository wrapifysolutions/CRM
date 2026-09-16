"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { loginSchema, registerSchema } from "@/lib/validations";
import { enforceRateLimit } from "@/core/security/enforce-rate-limit";
import type { ActionResult } from "@/core/types/result";
import { fromAppError } from "@/core/types/result";
import {
  loginWithMongo,
  logoutMongo,
  resendRegistrationOtp,
  startRegistrationWithOtp,
  verifyRegistrationOtp,
} from "@/lib/auth/mongo-auth";
import {
  completePasswordReset,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
} from "@/lib/auth/password-reset";
import type { UserRole } from "@/types/database";

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    enforceRateLimit(`auth:login:${String(formData.get("email") || "anon")}`, {
      limit: 15,
      windowMs: 60_000,
    });

    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input",
        code: "VALIDATION",
      };
    }

    const result = await loginWithMongo(parsed.data);
    if (result.approval_status !== "approved") {
      redirect("/pending");
    }

    const rawRedirect = String(formData.get("redirect") || "").trim();
    const safeRedirect =
      rawRedirect.startsWith("/") &&
      !rawRedirect.startsWith("//") &&
      !rawRedirect.includes("://")
        ? rawRedirect
        : null;

    if (safeRedirect) {
      if (result.role === "client" && safeRedirect.startsWith("/portal")) {
        redirect(safeRedirect);
      }
      if (result.role !== "client" && !safeRedirect.startsWith("/portal")) {
        redirect(safeRedirect);
      }
    }

    redirect(result.role === "client" ? "/portal" : "/dashboard");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return fromAppError(error);
  }
}

export async function registerAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    enforceRateLimit(`auth:register:${String(formData.get("email") || "anon")}`, {
      limit: 8,
      windowMs: 60_000,
    });

    const role = (formData.get("role") || "employee") as UserRole;
    if (role === "super_admin" || role === "client") {
      return {
        success: false,
        error: "This role cannot be self-registered",
        code: "FORBIDDEN",
      };
    }

    const parsed = registerSchema.safeParse({
      full_name: formData.get("full_name"),
      email: formData.get("email"),
      password: formData.get("password"),
      role,
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input",
        code: "VALIDATION",
      };
    }

    await startRegistrationWithOtp({
      email: parsed.data.email,
      password: parsed.data.password,
      full_name: parsed.data.full_name,
      role: parsed.data.role as UserRole,
      reports_to: (formData.get("reports_to") as string) || null,
    });

    redirect(
      `/verify-email?email=${encodeURIComponent(parsed.data.email.toLowerCase().trim())}`
    );
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return fromAppError(error);
  }
}

export async function verifyEmailOtpAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const email = String(formData.get("email") || "")
      .toLowerCase()
      .trim();
    enforceRateLimit(`auth:verify-otp:${email || "anon"}`, {
      limit: 20,
      windowMs: 60_000,
    });

    await verifyRegistrationOtp({
      email,
      otp: String(formData.get("otp") || ""),
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return fromAppError(error);
  }

  redirect("/pending");
}

export async function resendEmailOtpAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const email = String(formData.get("email") || "")
      .toLowerCase()
      .trim();
    enforceRateLimit(`auth:resend-otp:${email || "anon"}`, {
      limit: 5,
      windowMs: 10 * 60_000,
    });
    await resendRegistrationOtp(email);
    return {
      success: true,
      data: { message: "A new verification code was sent to your email." },
    };
  } catch (error) {
    return fromAppError(error);
  }
}

export async function forgotPasswordRequestAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const email = String(formData.get("email") || "")
      .toLowerCase()
      .trim();
    enforceRateLimit(`auth:forgot:${email || "anon"}`, {
      limit: 5,
      windowMs: 10 * 60_000,
    });
    if (!email.includes("@")) {
      return { success: false, error: "Valid email required", code: "VALIDATION" };
    }
    await requestPasswordResetOtp(email);
    redirect(`/forgot-password/verify?email=${encodeURIComponent(email)}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return fromAppError(error);
  }
}

export async function forgotPasswordVerifyAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const email = String(formData.get("email") || "")
      .toLowerCase()
      .trim();
    enforceRateLimit(`auth:forgot-verify:${email || "anon"}`, {
      limit: 20,
      windowMs: 60_000,
    });
    await verifyPasswordResetOtp({
      email,
      otp: String(formData.get("otp") || ""),
    });
    redirect(`/forgot-password/reset?email=${encodeURIComponent(email)}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return fromAppError(error);
  }
}

export async function forgotPasswordResetAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const email = String(formData.get("email") || "")
      .toLowerCase()
      .trim();
    const password = String(formData.get("password") || "");
    const confirm = String(formData.get("confirm_password") || "");
    enforceRateLimit(`auth:forgot-reset:${email || "anon"}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (password !== confirm) {
      return {
        success: false,
        error: "Passwords do not match",
        code: "VALIDATION",
      };
    }
    await completePasswordReset({ email, password });
    redirect("/login?reset=1");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return fromAppError(error);
  }
}

export async function logoutAction() {
  await logoutMongo();
  revalidatePath("/", "layout");
  redirect("/");
}
