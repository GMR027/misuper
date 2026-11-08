/** Friendly messages for the auth screens. */

import { ApiError, apiErrorMessage, apiFieldError } from "@/lib/api";
import { t } from "@/lib/i18n";

export function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "INVALID_CREDENTIALS") return t("login.invalid");
    if (error.code === "RATE_LIMITED") return t("login.rateLimited");
    if (error.code === "NETWORK_ERROR" || error.status === 0) {
      return t("login.network");
    }
    if (error.code === "VALIDATION_ERROR") {
      return apiFieldError(error) ?? error.message;
    }
    return error.message;
  }

  return apiErrorMessage(error);
}
