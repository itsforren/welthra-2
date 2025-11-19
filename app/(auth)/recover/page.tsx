"use client";

import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type RecoverActionState,
  type RecoverLookupState,
  recoverLookup,
  recoverPassword,
} from "../actions";

export default function Page() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [lookupState, lookupAction] = useActionState<
    RecoverLookupState,
    FormData
  >(recoverLookup, {
    status: "idle",
  });

  const [state, formAction] = useActionState<RecoverActionState, FormData>(
    recoverPassword,
    { status: "idle" }
  );

  useEffect(() => {
    if (lookupState.status === "user_not_found") {
      toast({ type: "error", description: "Account not found." });
    } else if (lookupState.status === "invalid_data") {
      toast({
        type: "error",
        description: "Failed validating your submission.",
      });
    } else if (lookupState.status === "user_found") {
      toast({
        type: "success",
        description: "Account found. You can now set a new password.",
      });
    }
  }, [lookupState.status]);

  useEffect(() => {
    if (state.status === "user_not_found") {
      toast({ type: "error", description: "Account not found." });
    } else if (state.status === "failed") {
      toast({ type: "error", description: "Failed to reset password." });
    } else if (state.status === "invalid_data") {
      toast({
        type: "error",
        description: "Failed validating your submission.",
      });
    } else if (state.status === "success") {
      toast({ type: "success", description: "Password updated successfully." });

      setIsSuccessful(true);
      router.push("/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, router]);

  const handleLookupSubmit = (formData: FormData) => {
    const submittedEmail = formData.get("email") as string;
    setEmail(submittedEmail);
    lookupAction(formData);
  };

  const handleRecoverSubmit = (formData: FormData) => {
    formData.set("email", email);
    formAction(formData);
  };

  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <div className="flex w-full max-w-md flex-col gap-12 overflow-hidden rounded-2xl">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="font-semibold text-xl dark:text-zinc-50">
            Reset password
          </h3>
          <p className="text-gray-500 text-sm dark:text-zinc-400">
            Enter your email and a new password to reset your account.
          </p>
        </div>
        <div className="flex flex-col gap-6 px-4 sm:px-16">
          {/* Step 1: lookup by email */}
          <Form
            action={handleLookupSubmit}
            className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-4"
          >
            <div className="flex flex-col gap-2">
              <Label
                className="font-normal text-zinc-600 dark:text-zinc-400"
                htmlFor="recover-email"
              >
                Email Address
              </Label>
              <Input
                autoComplete="email"
                className="bg-muted text-md md:text-sm"
                defaultValue={email}
                id="recover-email"
                name="email"
                placeholder="user@acme.com"
                required
                type="email"
              />
            </div>
            <SubmitButton isSuccessful={false}>
              {lookupState.status === "user_found"
                ? "Email verified"
                : "Verify email"}
            </SubmitButton>
          </Form>

          {/* Step 2: new password, only if user exists */}
          {lookupState.status === "user_found" && (
            <Form
              action={handleRecoverSubmit}
              className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-4"
            >
              <div className="flex flex-col gap-2">
                <Label
                  className="font-normal text-zinc-600 dark:text-zinc-400"
                  htmlFor="recover-password"
                >
                  New password
                </Label>
                <Input
                  className="bg-muted text-md md:text-sm"
                  id="recover-password"
                  name="password"
                  required
                  type="password"
                />
              </div>
              <SubmitButton isSuccessful={isSuccessful}>
                Reset password
              </SubmitButton>
              <p className="mt-4 text-center text-gray-600 text-sm dark:text-zinc-400">
                {"Remembered your password? "}
                <Link
                  className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
                  href="/login"
                >
                  Sign in
                </Link>
                {" instead."}
              </p>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
