import { Suspense } from "react";
import { ResetPasswordForm } from "../../components/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="app-shell centered">Loading reset form...</main>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
